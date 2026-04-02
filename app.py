from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
import os
import re
import pandas as pd
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from werkzeug.utils import secure_filename
import gc

from config import Config
from database import db, init_db, User, UploadHistory, Forecast, BarangayData, get_aggregated_data
from auth import auth_bp, admin_bp
from models.data_processor import DataProcessor
from models.lstm_model import LSTMForecaster
from ultimate_auto_preprocessor import UltimateAutoPreprocessor, is_morbidity_format, parse_morbidity_file
from smart_health_preprocessor import SmartHealthPreprocessor
from barangay_city_detector import detect_city_from_barangays

app = Flask(__name__)
app.config.from_object(Config)

# ── Database + JWT setup (BAGONG ADDITIONS) ───────────────
db.init_app(app)
jwt = JWTManager(app)

CORS(app, origins=["http://localhost:3000", "http://localhost:5173"], supports_credentials=True)

# ── Register auth blueprints (BAGONG ADDITIONS) ───────────
app.register_blueprint(auth_bp,  url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

@app.after_request
def after_request(response):
    # CORS is handled by flask-cors above — do not add duplicate headers here
    return response

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['MODEL_FOLDER'], exist_ok=True)


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'xlsx', 'xls', 'csv'}


def detect_disease_columns(df):
    exclude = {'city', 'barangay', 'year', 'month', 'health_facilities_count'}
    return [
        col for col in df.columns
        if (col.endswith('_cases') or col == 'malnutrition_prevalence_pct')
        and col not in exclude
    ]


def clean_floats(lst):
    """Replace NaN/Inf floats with 0.0 so JSON/PostgreSQL won't choke."""
    import math
    result = []
    for v in lst:
        try:
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                result.append(0.0)
            else:
                result.append(v)
        except Exception:
            result.append(0.0)
    return result


def build_forecast_dates(last_date, forecast_months):
    """
    Build forecast date strings starting from current month or last data date,
    whichever is later. Always starts from the NEXT month after the reference point.

    Example: if today is April 2026 and last data is Dec 2025,
    forecast starts from May 2026 (next month after April).
    """
    today = date.today()
    current_month_start = datetime(today.year, today.month, 1)

    # Use whichever is later: current month or last data month
    if current_month_start > last_date:
        reference = current_month_start
    else:
        reference = last_date

    return [
        (reference + relativedelta(months=i+1)).strftime('%Y-%m')
        for i in range(forecast_months)
    ]


def load_and_merge_sheets(file_path):
    try:
        print("   🔄 Using UltimateAutoPreprocessor...")
        preprocessor = UltimateAutoPreprocessor()
        df = preprocessor.process_file(file_path)
        if hasattr(preprocessor, 'complete_time_series'):
            df = preprocessor.complete_time_series(df)
        else:
            smart = SmartHealthPreprocessor()
            df = smart.complete_time_series(df)
        return df
    except Exception as e:
        print(f"   ⚠️ UltimateAutoPreprocessor failed: {e}")
        print(f"   🔄 Trying SmartHealthPreprocessor fallback...")
        try:
            preprocessor = SmartHealthPreprocessor()
            df = preprocessor.process_file(file_path)
            df = preprocessor.complete_time_series(df)
            return df
        except Exception as e2:
            print(f"   ⚠️ SmartHealthPreprocessor also failed: {e2}")
            print(f"   🔄 Final fallback: direct Excel read...")
            return pd.read_excel(file_path, sheet_name=0)


def resolve_city(df, filename=''):
    if 'city' in df.columns:
        city_vals = df['city'].dropna().astype(str)
        city_vals = city_vals[~city_vals.str.strip().str.lower().isin(['', 'unknown'])]
        if not city_vals.empty:
            city = city_vals.iloc[0].strip()
            print(f"   📍 City (from file): {city}")
            return city

    if 'barangay' in df.columns:
        barangays = df['barangay'].dropna().unique().tolist()
        city = detect_city_from_barangays(barangays)
        if city:
            print(f"   📍 City (auto-detected from barangays): {city}")
            return city

    if filename:
        name = os.path.splitext(os.path.basename(filename))[0]
        parts = re.split(r'[_\-\s]+', name)
        if parts:
            candidate = parts[0].strip()
            skip = {'data', 'health', 'file', 'upload', 'report', 'cchain', 'xlsx', 'xls'}
            if len(candidate) > 2 and candidate.lower() not in skip:
                print(f"   📍 City (from filename): {candidate}")
                return candidate

    print(f"   ⚠️  City not detected")
    return ''


# ── Helper: get logged-in user (BAGONG ADDITION) ──────────
def get_current_user():
    return db.session.get(User, int(get_jwt_identity()))


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'}), 200


@app.route('/api/barangays', methods=['POST'])
@jwt_required()                          # ← BAGONG: kailangan ng login
def get_barangays():
    current_user = get_current_user()    # ← BAGONG: sino ang nag-upload
    filepath = None

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only .xlsx, .xls, and .csv are allowed'}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # ── Detect format: morbidity (DOH) vs standard ────────────────────
        is_morbidity = False
        df_wide      = None
        db_records   = None

        try:
            # Peek at first sheet to check format
            _peek = pd.read_excel(filepath, sheet_name=0, nrows=3, engine='openpyxl')
            _peek.columns = [str(c).strip() for c in _peek.columns]
            is_morbidity = is_morbidity_format(_peek)
        except Exception:
            is_morbidity = False

        if is_morbidity:
            print("   📋 Detected: DOH Morbidity format (ICD-10 with age/sex breakdown)")
            df_wide, db_records = parse_morbidity_file(filepath)
            df_processed = df_wide
        else:
            print("   📋 Detected: Standard health data format")
            try:
                preprocessor = UltimateAutoPreprocessor()
                df_processed = preprocessor.process_file(filepath)
                if hasattr(preprocessor, 'complete_time_series'):
                    df_processed = preprocessor.complete_time_series(df_processed)
                else:
                    smart = SmartHealthPreprocessor()
                    df_processed = smart.complete_time_series(df_processed)
            except Exception as e:
                print(f"   ⚠️ UltimateAutoPreprocessor failed: {e}, trying SmartHealthPreprocessor...")
                preprocessor = SmartHealthPreprocessor()
                df_processed = preprocessor.process_file(filepath)
                df_processed = preprocessor.complete_time_series(df_processed)

        # ── Extract metadata ───────────────────────────────────────────────
        barangays = sorted(df_processed['barangay'].dropna().unique().tolist()) \
                    if 'barangay' in df_processed.columns else ['Unknown']

        disease_columns = [
            c for c in df_processed.columns
            if c.endswith('_cases') or c == 'malnutrition_prevalence_pct'
        ]

        city = resolve_city(df_processed, filename)
        city_detected = bool(city)

        start_date = end_date = ''
        if 'year' in df_processed.columns and 'month' in df_processed.columns:
            df_processed['_date'] = pd.to_datetime(
                df_processed['year'].astype(str) + '-' +
                df_processed['month'].astype(str).str.zfill(2) + '-01',
                errors='coerce'
            )
            valid_dates = df_processed.dropna(subset=['_date'])
            if not valid_dates.empty:
                start_date = valid_dates['_date'].min().strftime('%Y-%m-%d')
                end_date   = valid_dates['_date'].max().strftime('%Y-%m-%d')

        # ── Save upload history ────────────────────────────────────────────
        upload_record = UploadHistory(
            user_id          = current_user.id,
            filename         = filename,
            city             = city or None,
            barangay_count   = len(barangays),
            disease_count    = len(disease_columns),
            date_range_start = start_date or None,
            date_range_end   = end_date or None,
            status           = 'success',
        )
        db.session.add(upload_record)
        db.session.commit()

        # ── Save barangay_data records ─────────────────────────────────────
        BATCH = 500

        if is_morbidity and db_records:
            # Morbidity format: full age/sex breakdown per disease category
            col_map = BarangayData.AGE_SEX_COL_MAP
            rows = []
            for rec in db_records:
                kwargs = dict(
                    upload_id        = upload_record.id,
                    city             = rec.get('city') or city or None,
                    barangay         = rec['barangay'],
                    year             = rec['year'],
                    month            = rec['month'],
                    disease_category = rec['disease_category'],
                    disease_label    = rec['disease_label'],
                    total_male       = rec.get('total_male', 0),
                    total_female     = rec.get('total_female', 0),
                    total_cases      = rec.get('total_cases', 0),
                )
                # Map all age/sex cols
                for src_col, attr in col_map.items():
                    kwargs[attr] = rec.get(src_col)
                rows.append(BarangayData(**kwargs))

            for i in range(0, len(rows), BATCH):
                db.session.bulk_save_objects(rows[i:i+BATCH])
                db.session.commit()
            print(f"   💾 {len(rows)} morbidity records saved to DB")

        elif 'barangay' in df_processed.columns and 'year' in df_processed.columns:
            # Standard format: one row per disease category, no age/sex breakdown
            rows = []
            for _, row in df_processed.iterrows():
                brgy  = str(row['barangay']).strip()
                year  = int(row['year'])
                month = int(row['month'])
                for disease in disease_columns:
                    count = int(row[disease]) if pd.notna(row.get(disease)) else 0
                    # Map disease col name → category key
                    cat_key = disease.replace('_cases', '')
                    rows.append(BarangayData(
                        upload_id        = upload_record.id,
                        city             = city or None,
                        barangay         = brgy,
                        year             = year,
                        month            = month,
                        disease_category = cat_key,
                        disease_label    = cat_key.replace('_', ' ').title(),
                        total_male       = 0,
                        total_female     = 0,
                        total_cases      = count,
                    ))

            for i in range(0, len(rows), BATCH):
                db.session.bulk_save_objects(rows[i:i+BATCH])
                db.session.commit()
            print(f"   💾 {len(rows)} standard records saved to DB")

        del df_processed
        gc.collect()

        print(f"✅ Upload complete | Barangays: {len(barangays)} | "
              f"Categories: {len(disease_columns)} | City: '{city}' | "
              f"Range: {start_date} → {end_date}")

        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except (PermissionError, FileNotFoundError, OSError) as e:
            print(f"⚠️ Could not delete temp file: {e}")

        return jsonify({
            'barangays':       barangays,
            'disease_columns': disease_columns,
            'city':            city,
            'city_detected':   city_detected,
            'start_date':      start_date,
            'end_date':        end_date,
            'upload_id':       upload_record.id,
            'is_morbidity':    is_morbidity,
        }), 200

    except Exception as e:
        # ── BAGONG: I-log ang failed upload ───────────────
        if current_user:
            db.session.add(UploadHistory(
                user_id   = current_user.id,
                filename  = file.filename,
                status    = 'failed',
                error_msg = str(e),
            ))
            db.session.commit()

        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except (PermissionError, FileNotFoundError, OSError):
                pass
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/climate', methods=['GET'])
@jwt_required()                          # ← BAGONG: kailangan ng login
def get_climate():
    import requests as req

    city       = request.args.get('city', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date   = request.args.get('end_date', '').strip()

    if not city:
        return jsonify({
            'error': 'City name is required for climate data.',
            'needs_city_input': True
        }), 400

    if not start_date or not end_date:
        return jsonify({'error': 'start_date and end_date are required'}), 400

    try:
        geo_url = 'https://geocoding-api.open-meteo.com/v1/search'
        geo_data = {}
        for params in [
            {'name': city, 'count': 1, 'language': 'en', 'format': 'json', 'country_code': 'PH'},
            {'name': city, 'count': 1, 'language': 'en', 'format': 'json'},
        ]:
            geo_res  = req.get(geo_url, params=params, timeout=10)
            geo_data = geo_res.json()
            if geo_data.get('results'):
                break

        if not geo_data.get('results'):
            return jsonify({
                'error': f"Could not find coordinates for '{city}'. Please check the city name.",
                'needs_city_input': True
            }), 404

        lat           = geo_data['results'][0]['latitude']
        lng           = geo_data['results'][0]['longitude']
        resolved_city = geo_data['results'][0].get('name', city)
        print(f"📍 Geocoded '{city}' → {resolved_city} ({lat}, {lng})")

        climate_res = req.get('https://archive-api.open-meteo.com/v1/archive', params={
            'latitude':   lat,
            'longitude':  lng,
            'start_date': start_date,
            'end_date':   end_date,
            'monthly':    'temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean',
            'timezone':   'Asia/Manila',
        }, timeout=30)
        climate_data = climate_res.json()

        if 'monthly' not in climate_data:
            return jsonify({'error': 'No climate data returned from Open-Meteo'}), 502

        monthly = climate_data['monthly']
        times   = monthly.get('time', [])
        temps   = monthly.get('temperature_2m_mean', [])
        rain    = monthly.get('precipitation_sum', [])
        humid   = monthly.get('relative_humidity_2m_mean', [])

        records = []
        for i, t in enumerate(times):
            records.append({
                'month':       t[:7],
                'temperature': round(temps[i], 1) if i < len(temps) and temps[i] is not None else None,
                'rainfall':    round(rain[i],  1) if i < len(rain)  and rain[i]  is not None else None,
                'humidity':    round(humid[i], 1) if i < len(humid) and humid[i] is not None else None,
            })

        return jsonify({
            'city':    resolved_city,
            'lat':     lat,
            'lng':     lng,
            'records': records,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast', methods=['POST'])
@jwt_required()                          # ← BAGONG: kailangan ng login
def forecast():
    current_user = get_current_user()    # ← BAGONG: sino ang nag-forecast
    filepath = None

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    barangay        = request.form.get('barangay')
    target_diseases = request.form.getlist('diseases')
    forecast_months = int(request.form.get('forecast_months', 6))
    city            = request.form.get('city', '')    # ← BAGONG: para sa DB record

    if not barangay:
        return jsonify({'error': 'Barangay not specified'}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        df_merged = load_and_merge_sheets(filepath)

        if not target_diseases:
            target_diseases = detect_disease_columns(df_merged)

        target_diseases = [d for d in target_diseases if d in df_merged.columns]

        if not target_diseases:
            return jsonify({'error': 'No valid disease columns found in the uploaded file.'}), 400

        processor   = DataProcessor(sequence_length=app.config['SEQUENCE_LENGTH'])
        df_filtered = processor.load_and_filter_data_from_df(df_merged, barangay)

        del df_merged
        gc.collect()

        scaled_data, feature_cols = processor.prepare_features(df_filtered, target_diseases)
        target_indices = [feature_cols.index(col) for col in target_diseases]
        X, y           = processor.create_sequences(scaled_data, target_indices)

        if len(X) < 20:
            return jsonify({'error': 'Not enough historical data for training. Need at least 32 months of data.'}), 400

        forecaster = LSTMForecaster(
            sequence_length=app.config['SEQUENCE_LENGTH'],
            n_features=len(feature_cols),
            n_outputs=len(target_diseases)
        )

        forecaster.build_model()
        print(f"🧠 Training model for {barangay} | diseases: {target_diseases} | features: {len(feature_cols)}")
        forecaster.train(X, y, epochs=app.config['EPOCHS'], batch_size=app.config['BATCH_SIZE'])

        last_sequence        = scaled_data.values[-app.config['SEQUENCE_LENGTH']:]
        predictions_scaled   = forecaster.forecast(last_sequence, n_months=forecast_months)
        predictions_original = processor.inverse_transform_predictions(predictions_scaled, target_diseases)

        # ── UPDATED: Use current date as reference for forecast dates ──────
        last_date      = df_filtered['date'].max()
        forecast_dates = build_forecast_dates(last_date, forecast_months)
        print(f"   📅 Forecast dates: {forecast_dates[0]} → {forecast_dates[-1]}")

        predictions_dict = {
            disease: clean_floats(predictions_original[disease].tolist())
            for disease in target_diseases
        }
        historical_dict = {
            'dates': df_filtered['date'].dt.strftime('%Y-%m').tolist(),
            **{disease: clean_floats(df_filtered[disease].fillna(0).tolist()) for disease in target_diseases}
        }

        # ── BAGONG: I-save ang forecast result sa DB ───────
        forecast_record = Forecast(
            user_id         = current_user.id,
            city            = city or None,
            barangay        = barangay,
            diseases        = target_diseases,
            forecast_months = forecast_months,
            forecast_dates  = forecast_dates,
            predictions     = predictions_dict,
            historical_data = historical_dict,
        )
        db.session.add(forecast_record)
        db.session.commit()
        print(f"   💾 Forecast saved to DB (id={forecast_record.id})")

        del df_filtered, scaled_data, X, y, forecaster
        gc.collect()

        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except (PermissionError, FileNotFoundError, OSError) as e:
            print(f"⚠️ Could not delete {filepath}: {e}")

        print(f"✅ Forecast completed for {barangay}")
        return jsonify({
            'barangay':        barangay,
            'forecast_dates':  forecast_dates,
            'disease_columns': target_diseases,
            'predictions':     predictions_dict,
            'historical_data': historical_dict,
            'forecast_id':     forecast_record.id,   # ← BAGONG
        }), 200

    except Exception as e:
        if filepath and os.path.exists(filepath):
            try:
                gc.collect()
                os.remove(filepath)
            except (PermissionError, FileNotFoundError, OSError):
                pass
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ── BAGONG: View saved forecasts ──────────────────────────
@app.route('/api/forecasts', methods=['GET'])
@jwt_required()
def get_my_forecasts():
    u = get_current_user()
    q = Forecast.query if u.role == 'admin' \
        else Forecast.query.filter_by(user_id=u.id)
    return jsonify([f.to_dict() for f in
                    q.order_by(Forecast.created_at.desc()).limit(50).all()]), 200


@app.route('/api/forecasts/<int:fid>', methods=['GET'])
@jwt_required()
def get_forecast(fid):
    u = get_current_user()
    f = Forecast.query.get_or_404(fid)
    if f.user_id != u.id and u.role != 'admin':
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(f.to_dict()), 200


# ── NEW: Generate forecast directly from database ─────────
@app.route('/api/forecast-from-db', methods=['POST'])
@jwt_required()
def forecast_from_db():
    """
    Generate forecast using data already stored in barangay_data table.
    No file upload needed — reads directly from PostgreSQL.
    """
    current_user = get_current_user()
    data = request.get_json() or {}

    barangay        = data.get('barangay', '')
    target_diseases = data.get('diseases', [])
    forecast_months = int(data.get('forecast_months', 6))
    city            = data.get('city', '')

    if not barangay:
        return jsonify({'error': 'Barangay not specified'}), 400

    try:
        # ── Load aggregated data from DB (flat → pivoted) ──
        aggregated = get_aggregated_data(
            city     = city or None,
            barangay = barangay,
        )

        if not aggregated:
            return jsonify({'error': f'No data found in database for barangay: {barangay}. Please upload a dataset first.'}), 404

        df_merged = pd.DataFrame(aggregated)
        print(f"   📊 Loaded {len(df_merged)} pivoted rows from DB for barangay: {barangay}")

        # ── Auto-detect disease columns if not specified ───
        if not target_diseases:
            target_diseases = detect_disease_columns(df_merged)

        target_diseases = [d for d in target_diseases if d in df_merged.columns]

        if not target_diseases:
            return jsonify({'error': 'No valid disease columns found in database records.'}), 400

        # ── Run LSTM forecast ──────────────────────────────
        processor = DataProcessor(sequence_length=app.config['SEQUENCE_LENGTH'])

        # For ALL barangays: aggregate across all barangays by year+month
        if barangay == '__ALL__':
            disease_cols = [c for c in target_diseases if c in df_merged.columns]
            df_merged = df_merged.groupby(['year', 'month'])[disease_cols].sum().reset_index()
            df_merged['barangay'] = 'All Barangays'
            df_merged['city']     = city or ''
            df_filtered = processor.load_and_filter_data_from_df(df_merged, 'All Barangays')
        else:
            df_filtered = processor.load_and_filter_data_from_df(df_merged, barangay)

        del df_merged
        gc.collect()

        scaled_data, feature_cols = processor.prepare_features(df_filtered, target_diseases)
        target_indices = [feature_cols.index(col) for col in target_diseases]
        X, y = processor.create_sequences(scaled_data, target_indices)

        if len(X) < 20:
            return jsonify({'error': 'Not enough historical data for training. Need at least 32 months of data.'}), 400

        forecaster = LSTMForecaster(
            sequence_length=app.config['SEQUENCE_LENGTH'],
            n_features=len(feature_cols),
            n_outputs=len(target_diseases)
        )
        forecaster.build_model()
        print(f"🧠 Training from DB for {barangay} | diseases: {target_diseases}")
        forecaster.train(X, y, epochs=app.config['EPOCHS'], batch_size=app.config['BATCH_SIZE'])

        last_sequence        = scaled_data.values[-app.config['SEQUENCE_LENGTH']:]
        predictions_scaled   = forecaster.forecast(last_sequence, n_months=forecast_months)
        predictions_original = processor.inverse_transform_predictions(predictions_scaled, target_diseases)

        # ── UPDATED: Use current date as reference for forecast dates ──────
        last_date      = df_filtered['date'].max()
        forecast_dates = build_forecast_dates(last_date, forecast_months)
        print(f"   📅 Forecast dates: {forecast_dates[0]} → {forecast_dates[-1]}")

        predictions_dict = {
            disease: clean_floats(predictions_original[disease].tolist())
            for disease in target_diseases
        }
        historical_dict = {
            'dates': df_filtered['date'].dt.strftime('%Y-%m').tolist(),
            **{disease: clean_floats(df_filtered[disease].fillna(0).tolist()) for disease in target_diseases}
        }

        # ── Save forecast to DB ────────────────────────────
        forecast_record = Forecast(
            user_id         = current_user.id,
            city            = city or None,
            barangay        = barangay,
            diseases        = target_diseases,
            forecast_months = forecast_months,
            forecast_dates  = forecast_dates,
            predictions     = predictions_dict,
            historical_data = historical_dict,
        )
        db.session.add(forecast_record)
        db.session.commit()
        print(f"   💾 Forecast saved to DB (id={forecast_record.id})")

        del df_filtered, scaled_data, X, y, forecaster
        gc.collect()

        print(f"✅ DB Forecast completed for {barangay}")
        return jsonify({
            'barangay':        barangay,
            'city':            city,
            'forecast_dates':  forecast_dates,
            'disease_columns': target_diseases,
            'predictions':     predictions_dict,
            'historical_data': historical_dict,
            'forecast_id':     forecast_record.id,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ── Disease breakdown: top specific diseases under a category ─────────────────
@app.route('/api/disease-breakdown', methods=['GET'])
@jwt_required()
def disease_breakdown():
    from sqlalchemy import func, text

    category = request.args.get('category', '').strip()
    barangay = request.args.get('barangay', '__ALL__').strip()
    city     = request.args.get('city', '').strip()
    top_n    = int(request.args.get('top_n', 5))

    if not category:
        return jsonify({'error': 'category is required'}), 400

    try:
        q = db.session.query(
            BarangayData.disease_label,
            BarangayData.disease_category,
            func.sum(BarangayData.total_cases).label('total_cases'),
            func.sum(BarangayData.total_male).label('total_male'),
            func.sum(BarangayData.total_female).label('total_female'),
        ).filter(
            BarangayData.disease_category == category
        )

        if barangay and barangay != '__ALL__':
            q = q.filter(BarangayData.barangay.ilike(barangay))
        if city:
            q = q.filter(BarangayData.city.ilike(f'%{city}%'))

        q = q.group_by(
            BarangayData.disease_label,
            BarangayData.disease_category,
        ).order_by(func.sum(BarangayData.total_cases).desc()).limit(top_n)

        rows = q.all()

        # Also get monthly trend for the top disease
        monthly_trend = []
        if rows:
            top_label = rows[0].disease_label
            trend_q = db.session.query(
                BarangayData.year,
                BarangayData.month,
                func.sum(BarangayData.total_cases).label('cases'),
            ).filter(
                BarangayData.disease_category == category,
                BarangayData.disease_label    == top_label,
            )
            if barangay and barangay != '__ALL__':
                trend_q = trend_q.filter(BarangayData.barangay.ilike(barangay))
            if city:
                trend_q = trend_q.filter(BarangayData.city.ilike(f'%{city}%'))

            trend_q = trend_q.group_by(
                BarangayData.year, BarangayData.month
            ).order_by(BarangayData.year, BarangayData.month).limit(24)

            monthly_trend = [
                {'period': f"{r.year}-{str(r.month).zfill(2)}", 'cases': int(r.cases or 0)}
                for r in trend_q.all()
            ]

        return jsonify({
            'category': category,
            'barangay': barangay,
            'breakdown': [
                {
                    'label':        r.disease_label or category.replace('_', ' ').title(),
                    'category':     r.disease_category,
                    'total_cases':  int(r.total_cases or 0),
                    'total_male':   int(r.total_male or 0),
                    'total_female': int(r.total_female or 0),
                }
                for r in rows
            ],
            'monthly_trend': monthly_trend,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    init_db(app)   # ← BAGONG: gumawa ng tables + default admin
    print("🚀 Starting PredictHealth Backend...")
    print("📍 Server running on http://localhost:5000")
    print("📊 Ready to receive forecast requests!")
    print("🔓 CORS enabled for frontend access")
    app.run(debug=True, host='0.0.0.0', port=5000)