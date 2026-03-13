from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
import os, re
import pandas as pd
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from werkzeug.utils import secure_filename
import gc

from config import Config
from database import (db, init_db, User, UploadHistory, Forecast,
                      BarangayData, get_aggregated_data, classify_age)
from auth import auth_bp, admin_bp
from models.data_processor import DataProcessor
from models.lstm_model import LSTMForecaster
from ultimate_auto_preprocessor import UltimateAutoPreprocessor
from smart_health_preprocessor import SmartHealthPreprocessor
from barangay_city_detector import detect_city_from_barangays

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)
jwt = JWTManager(app)
CORS(app, origins=["http://localhost:3000","http://localhost:5173"], supports_credentials=True)
app.register_blueprint(auth_bp,  url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

@app.after_request
def after_request(r): return r

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['MODEL_FOLDER'],  exist_ok=True)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def allowed_file(f):
    return '.' in f and f.rsplit('.',1)[1].lower() in {'xlsx','xls','csv'}

def get_current_user():
    return db.session.get(User, int(get_jwt_identity()))

def get_disease_cols(df):
    skip = {'city','barangay','year','month','week','sex','age','age_group',
            'dominant_sex','dominant_age_group','upload_id','id','created_at'}
    return [c for c in df.columns
            if (c.endswith('_cases') or c == 'malnutrition_prevalence_pct')
            and c not in skip and not c.startswith('nan')]

def resolve_city(df, filename=''):
    if 'city' in df.columns:
        vals = df['city'].dropna().astype(str)
        vals = vals[~vals.str.strip().str.lower().isin(['','unknown'])]
        if not vals.empty: return vals.iloc[0].strip()
    if 'barangay' in df.columns:
        city = detect_city_from_barangays(df['barangay'].dropna().unique().tolist())
        if city: return city
    if filename:
        name  = os.path.splitext(os.path.basename(filename))[0]
        parts = re.split(r'[_\-\s]+', name)
        skip  = {'data','health','file','upload','report','xlsx','xls'}
        if parts and len(parts[0]) > 2 and parts[0].lower() not in skip:
            return parts[0].strip()
    return ''


# ─────────────────────────────────────────────
# EXTRACT SEX + AGE FROM RAW FILE
# (before preprocessor drops those columns)
# ─────────────────────────────────────────────
def dominant(series):
    s = series.dropna()
    if s.empty: return None
    return s.value_counts().idxmax()

def normalize_sex(val):
    if pd.isna(val): return None
    v = str(val).strip().upper()
    if v in ('M','MALE','LALAKI'):  return 'M'
    if v in ('F','FEMALE','BABAE'): return 'F'
    return None

def extract_sex_age_map(filepath):
    """
    Read raw file and build:
      { (barangay, year, month) → {'dominant_sex': 'F', 'dominant_age_group': 'Child (1-4 y/o)'} }

    Only works for Format A (individual case records) where sex/age exist per row.
    Returns empty dict for other formats.
    """
    try:
        ext = filepath.rsplit('.',1)[-1].lower()
        df  = pd.read_excel(filepath) if ext in ('xlsx','xls') \
              else pd.read_csv(filepath)

        df.columns = [c.strip().lower() for c in df.columns]

        has_sex = 'sex' in df.columns
        has_age = 'age' in df.columns

        if not (has_sex or has_age):
            return {}
        if 'year' not in df.columns or 'month' not in df.columns:
            return {}

        # Need barangay column
        brgy_col = next((c for c in df.columns
                         if any(k in c for k in ['barangay','brgy','bgy'])), None)
        if not brgy_col:
            return {}

        result = {}
        grp_keys = [brgy_col, 'year', 'month']
        for (brgy, year, month), grp in df.groupby(grp_keys):
            key = (str(brgy).strip(), int(year), int(month))

            dom_sex = None
            if has_sex:
                sex_series = grp['sex'].apply(normalize_sex)
                dom_sex    = dominant(sex_series)

            dom_age = None
            if has_age:
                age_groups = grp['age'].apply(classify_age)
                dom_age    = dominant(age_groups)

            result[key] = {
                'dominant_sex':       dom_sex,
                'dominant_age_group': dom_age,
            }

        print(f"   👤 Sex/age map built: {len(result)} barangay-month entries")
        return result

    except Exception as e:
        print(f"   ⚠️ Could not extract sex/age: {e}")
        return {}


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status':'healthy','message':'Backend is running'}), 200


# ─────────────────────────────────────────────
# UPLOAD
# ─────────────────────────────────────────────
@app.route('/api/barangays', methods=['POST'])
@jwt_required()
def get_barangays():
    current_user = get_current_user()
    filepath = None

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if not file.filename or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file. Use .xlsx, .xls, or .csv'}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # ── Step 1: Extract sex/age from raw file BEFORE preprocessing ────
        # UltimateAutoPreprocessor drops sex/age during grouping
        # We capture dominant sex/age per barangay+month first
        sex_age_map = extract_sex_age_map(filepath)

        # ── Step 2: Preprocess → standard wide DataFrame ──────────────────
        try:
            print("   🔄 UltimateAutoPreprocessor...")
            preprocessor = UltimateAutoPreprocessor()
            df = preprocessor.process_file(filepath)
            df = preprocessor.complete_time_series(df)
        except Exception as e:
            print(f"   ⚠️ UltimateAutoPreprocessor failed: {e} — trying SmartHealthPreprocessor...")
            preprocessor = SmartHealthPreprocessor()
            df = preprocessor.process_file(filepath)
            df = preprocessor.complete_time_series(df)

        if df is None or df.empty:
            return jsonify({'error': 'Could not read data from file'}), 400

        # ── Step 3: Resolve metadata ───────────────────────────────────────
        city         = resolve_city(df, filename)
        disease_cols = get_disease_cols(df)
        barangays    = sorted(df['barangay'].dropna().unique().tolist()) \
                       if 'barangay' in df.columns else []

        if not barangays:
            return jsonify({'error': 'No barangay column found in file'}), 400
        if not disease_cols:
            return jsonify({'error': 'No disease columns found in file'}), 400

        # Date range
        start_date = end_date = ''
        if 'year' in df.columns and 'month' in df.columns:
            _d = pd.to_datetime(
                df['year'].astype(str) + '-' + df['month'].astype(str).str.zfill(2) + '-01',
                errors='coerce'
            ).dropna()
            if not _d.empty:
                start_date = _d.min().strftime('%Y-%m-%d')
                end_date   = _d.max().strftime('%Y-%m-%d')

        # ── Step 4: Save upload record ────────────────────────────────────
        upload_record = UploadHistory(
            user_id          = current_user.id,
            filename         = filename,
            city             = city or None,
            barangay_count   = len(barangays),
            disease_count    = len(disease_cols),
            date_range_start = start_date or None,
            date_range_end   = end_date or None,
            status           = 'success',
        )
        db.session.add(upload_record)
        db.session.commit()

        # ── Step 5: Build BarangayData rows ───────────────────────────────
        # diseases = JSON with ONLY columns present in this file (no false zeros)
        # dominant_sex/age = from sex_age_map if available
        rows_to_save = []
        for _, row in df.iterrows():
            barangay = str(row.get('barangay', '')).strip()
            if not barangay or barangay.lower() in ('nan','none','unknown',''):
                continue
            try:
                year  = int(row['year'])
                month = int(row['month'])
            except (ValueError, KeyError, TypeError):
                continue

            # Build diseases dict: only store diseases with actual values
            # Skip diseases not in this file (don't store 0s for untracked diseases)
            diseases = {}
            for col in disease_cols:
                val = row.get(col)
                if val is None or (isinstance(val, float) and pd.isna(val)):
                    continue
                v = float(val)
                if v == 0:
                    continue   # skip zero-value diseases (not tracked this month)
                diseases[col] = round(v, 4) if col == 'malnutrition_prevalence_pct' \
                                else int(v)

            if not diseases:
                continue  # skip rows with no disease data

            # Get sex/age from map (Format A files)
            sex_age = sex_age_map.get((barangay, year, month), {})

            rows_to_save.append(BarangayData(
                upload_id          = upload_record.id,
                city               = city or None,
                barangay           = barangay,
                year               = year,
                month              = month,
                diseases           = diseases,
                dominant_sex       = sex_age.get('dominant_sex'),
                dominant_age_group = sex_age.get('dominant_age_group'),
            ))

        # Batch save
        BATCH = 500
        for i in range(0, len(rows_to_save), BATCH):
            db.session.bulk_save_objects(rows_to_save[i:i+BATCH])
            db.session.commit()

        has_sex_age = bool(sex_age_map)
        print(f"\n✅ Upload complete:")
        print(f"   📦 {len(rows_to_save)} rows saved to DB")
        print(f"   🏥 Diseases: {disease_cols}")
        print(f"   📍 City: '{city}'  |  {start_date} → {end_date}")
        print(f"   👤 Sex/Age data: {'Yes' if has_sex_age else 'No (not in file)'}")

        del df
        gc.collect()
        try:
            if os.path.exists(filepath): os.remove(filepath)
        except: pass

        return jsonify({
            'barangays':       barangays,
            'disease_columns': disease_cols,
            'city':            city,
            'city_detected':   bool(city),
            'start_date':      start_date,
            'end_date':        end_date,
            'upload_id':       upload_record.id,
            'has_sex_age':     has_sex_age,
        }), 200

    except Exception as e:
        try:
            db.session.add(UploadHistory(
                user_id   = current_user.id,
                filename  = file.filename,
                status    = 'failed',
                error_msg = str(e),
            ))
            db.session.commit()
        except: pass
        if filepath:
            try: os.remove(filepath)
            except: pass
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# CLIMATE
# ─────────────────────────────────────────────
@app.route('/api/climate', methods=['GET'])
@jwt_required()
def get_climate():
    import requests as req
    city       = request.args.get('city','').strip()
    start_date = request.args.get('start_date','').strip()
    end_date   = request.args.get('end_date','').strip()
    if not city:
        return jsonify({'error':'City required','needs_city_input':True}), 400
    try:
        geo = {}
        for p in [
            {'name':city,'count':1,'language':'en','format':'json','country_code':'PH'},
            {'name':city,'count':1,'language':'en','format':'json'},
        ]:
            r = req.get('https://geocoding-api.open-meteo.com/v1/search',params=p,timeout=10)
            geo = r.json()
            if geo.get('results'): break
        if not geo.get('results'):
            return jsonify({'error':f"Could not find '{city}'.",'needs_city_input':True}), 404
        lat = geo['results'][0]['latitude']
        lng = geo['results'][0]['longitude']
        cl  = req.get('https://archive-api.open-meteo.com/v1/archive', params={
            'latitude':lat,'longitude':lng,
            'start_date':start_date,'end_date':end_date,
            'monthly':'temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean',
            'timezone':'Asia/Manila',
        }, timeout=30).json()
        if 'monthly' not in cl:
            return jsonify({'error':'No climate data'}), 502
        m = cl['monthly']
        records = []
        for i,t in enumerate(m.get('time',[])):
            records.append({
                'month':       t[:7],
                'temperature': round(m['temperature_2m_mean'][i],1)      if m['temperature_2m_mean'][i]      is not None else None,
                'rainfall':    round(m['precipitation_sum'][i],1)         if m['precipitation_sum'][i]         is not None else None,
                'humidity':    round(m['relative_humidity_2m_mean'][i],1) if m['relative_humidity_2m_mean'][i] is not None else None,
            })
        return jsonify({'city':geo['results'][0].get('name',city),
                        'lat':lat,'lng':lng,'records':records}), 200
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error':str(e)}), 500


# ─────────────────────────────────────────────
# FORECAST — reads from DB
# ─────────────────────────────────────────────
@app.route('/api/forecast', methods=['POST'])
@jwt_required()
def forecast():
    current_user = get_current_user()
    data = request.get_json() or {}

    barangay        = data.get('barangay','')
    target_diseases = data.get('diseases',[])
    forecast_months = int(data.get('forecast_months',6))
    city            = data.get('city','')

    if not barangay:
        return jsonify({'error':'Barangay not specified'}), 400

    try:
        print(f"\n🔍 Loading from DB: '{barangay}'")
        aggregated = get_aggregated_data(city=city or None, barangay=barangay)
        if not aggregated:
            return jsonify({
                'error': f"No data found for '{barangay}'. Please upload a dataset first."
            }), 404

        df = pd.DataFrame(aggregated)
        print(f"   ✅ {len(df)} monthly rows from DB")

        if not target_diseases:
            target_diseases = get_disease_cols(df)
        else:
            target_diseases = [d for d in target_diseases if d in df.columns]

        if not target_diseases:
            return jsonify({'error': 'No disease columns found for this barangay.'}), 400

        if not city and 'city' in df.columns:
            cv = [c for c in df['city'].dropna().unique()
                  if c and str(c).lower() not in ('unknown','')]
            if cv: city = cv[0]

        print(f"   📊 Diseases : {target_diseases}")
        print(f"   🏙️  City     : {city or '(not set)'}")

        processor = DataProcessor(sequence_length=6)

        if barangay == '__ALL__':
            dc  = [c for c in target_diseases if c in df.columns]
            dfa = df.groupby(['year','month'])[dc].sum().reset_index()
            dfa['barangay'] = 'All Barangays'
            dfa['city']     = city or ''
            df_f = processor.load_and_filter_data_from_df(dfa, 'All Barangays')
        else:
            df_f = processor.load_and_filter_data_from_df(df, barangay)

        del df; gc.collect()

        if df_f is None or df_f.empty:
            return jsonify({'error': f"No valid data for '{barangay}'"}), 400

        scaled, feature_cols = processor.prepare_features(df_f, target_diseases, city=city)
        target_diseases = [d for d in target_diseases if d in feature_cols]
        if not target_diseases:
            return jsonify({'error': 'Disease columns lost during feature preparation.'}), 400

        target_idx = [feature_cols.index(d) for d in target_diseases]
        X, y       = processor.create_sequences(scaled, target_idx)

        if len(X) < 10:
            return jsonify({
                'error': f'Not enough data — {len(X)} sequences found, need ≥10. '
                         f'Try uploading more years of data.'
            }), 400

        model = LSTMForecaster(
            sequence_length = app.config['SEQUENCE_LENGTH'],
            n_features      = len(feature_cols),
            n_outputs       = len(target_diseases),
        )
        model.build_model()
        print(f"🧠 Training LSTM | {len(feature_cols)} features | {len(X)} sequences")
        model.train(X, y, epochs=app.config['EPOCHS'], batch_size=app.config['BATCH_SIZE'])

        last_seq   = scaled.values[-app.config['SEQUENCE_LENGTH']:]
        preds_sc   = model.forecast(last_seq, n_months=forecast_months)
        preds_orig = processor.inverse_transform_predictions(preds_sc, target_diseases)

        last_date      = df_f['date'].max()
        forecast_dates = [(last_date + relativedelta(months=i+1)).strftime('%Y-%m')
                          for i in range(forecast_months)]
        def clean_val(v):
            """Convert NaN/Inf → 0 so PostgreSQL JSON accepts it."""
            try:
                f = float(v)
                return 0.0 if (f != f or f == float('inf') or f == float('-inf')) else round(f, 2)
            except:
                return 0.0

        preds_dict = {d:[max(0, clean_val(v)) for v in preds_orig[d].tolist()]
                      for d in target_diseases}
        hist_dict  = {
            'dates': df_f['date'].dt.strftime('%Y-%m').tolist(),
            **{d:[clean_val(v) for v in df_f[d].tolist()] for d in target_diseases}
        }

        rec = Forecast(
            user_id=current_user.id, city=city or None, barangay=barangay,
            diseases=target_diseases, forecast_months=forecast_months,
            forecast_dates=forecast_dates, predictions=preds_dict,
            historical_data=hist_dict,
        )
        db.session.add(rec); db.session.commit()
        print(f"   💾 Forecast saved (id={rec.id})")

        del df_f, scaled, X, y, model; gc.collect()

        return jsonify({
            'barangay':        barangay,
            'city':            city,
            'forecast_dates':  forecast_dates,
            'disease_columns': target_diseases,
            'predictions':     preds_dict,
            'historical_data': hist_dict,
            'forecast_id':     rec.id,
        }), 200

    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# FORECASTS
# ─────────────────────────────────────────────
@app.route('/api/forecasts', methods=['GET'])
@jwt_required()
def get_my_forecasts():
    u = get_current_user()
    q = Forecast.query if u.role=='admin' \
        else Forecast.query.filter_by(user_id=u.id)
    return jsonify([f.to_dict() for f in
                    q.order_by(Forecast.created_at.desc()).limit(50).all()]), 200

@app.route('/api/forecasts/<int:fid>', methods=['GET'])
@jwt_required()
def get_forecast_by_id(fid):
    u = get_current_user()
    f = Forecast.query.get_or_404(fid)
    if f.user_id != u.id and u.role != 'admin':
        return jsonify({'error':'Access denied'}), 403
    return jsonify(f.to_dict()), 200


if __name__ == '__main__':
    init_db(app)
    print("🚀 PredictHealth Backend → http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)