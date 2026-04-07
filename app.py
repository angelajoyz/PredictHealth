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
from database import (db, init_db, User, UploadHistory, Forecast, ForecastResult,
                      BarangayData, get_aggregated_data,
                      get_saved_forecast_dict, get_all_saved_forecast_dict)
from auth import auth_bp, admin_bp
from models.data_processor import DataProcessor
from models.lstm_model import LSTMForecaster
from ultimate_auto_preprocessor import UltimateAutoPreprocessor, is_morbidity_format, parse_morbidity_file
from smart_health_preprocessor import SmartHealthPreprocessor
from barangay_city_detector import detect_city_from_barangays

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
jwt = JWTManager(app)

CORS(app, origins=["http://localhost:3000", "http://localhost:5173"], supports_credentials=True)

app.register_blueprint(auth_bp,  url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

@app.after_request
def after_request(response):
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
    import math
    result = []
    for v in lst:
        try:
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                result.append(0.0)
            else:
                result.append(float(v))
        except Exception:
            result.append(0.0)
    return result


def build_forecast_dates(last_date, forecast_months):
    today = date.today()
    current_month_start = datetime(today.year, today.month, 1)
    if current_month_start > last_date:
        reference = current_month_start
    else:
        reference = last_date
    return [
        (reference + relativedelta(months=i+1)).strftime('%Y-%m')
        for i in range(forecast_months)
    ]


def save_forecast_flat(user_id, city, barangay, diseases, forecast_months,
                       forecast_dates, predictions_dict, historical_dict):
    """
    Save forecast header + flat ForecastResult rows.

    Two types of rows are stored:
      1. Forecast rows   — forecast_period set,   historical_period = NULL
      2. Historical rows — historical_period set, forecast_period   = NULL

    This clean separation makes to_api_dict() unambiguous and correct.
    """
    # Delete old forecasts for this barangay
    old = Forecast.query.filter_by(barangay=barangay, city=city or None).all()
    for o in old:
        db.session.delete(o)
    db.session.flush()

    # Create header record
    record = Forecast(
        user_id         = user_id,
        city            = city or None,
        barangay        = barangay,
        diseases        = diseases,
        forecast_months = forecast_months,
        forecast_dates  = forecast_dates,
    )
    db.session.add(record)
    db.session.flush()  # get record.id

    hist_dates = historical_dict.get('dates', [])
    rows = []

    for disease_col in diseases:
        cat_key   = disease_col.replace('_cases', '')
        pred_vals = predictions_dict.get(disease_col, [])
        hist_vals = historical_dict.get(disease_col, [])

        # ── Forecast rows (one per forecast period) ──────────
        # forecast_period is set, historical_period is NULL
        for i, period in enumerate(forecast_dates):
            predicted = float(pred_vals[i]) if i < len(pred_vals) else 0.0
            rows.append(ForecastResult(
                forecast_id       = record.id,
                city              = city or None,
                barangay          = barangay,
                disease_category  = cat_key,
                disease_label     = cat_key.replace('_', ' ').title(),
                forecast_period   = period,   # set
                predicted_cases   = predicted,
                historical_period = None,     # NULL
                historical_cases  = None,     # NULL
            ))

        # ── Historical rows (one per historical period) ──────
        # historical_period is set, forecast_period is NULL
        for j, hperiod in enumerate(hist_dates):
            hval = float(hist_vals[j]) if j < len(hist_vals) else 0.0
            rows.append(ForecastResult(
                forecast_id       = record.id,
                city              = city or None,
                barangay          = barangay,
                disease_category  = cat_key,
                disease_label     = cat_key.replace('_', ' ').title(),
                forecast_period   = None,     # NULL
                predicted_cases   = 0.0,
                historical_period = hperiod,  # set
                historical_cases  = hval,
            ))

    BATCH = 500
    for i in range(0, len(rows), BATCH):
        db.session.bulk_save_objects(rows[i:i+BATCH])

    db.session.commit()
    return record


def load_and_merge_sheets(file_path):
    try:
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
        try:
            preprocessor = SmartHealthPreprocessor()
            df = preprocessor.process_file(file_path)
            df = preprocessor.complete_time_series(df)
            return df
        except Exception as e2:
            print(f"   ⚠️ SmartHealthPreprocessor also failed: {e2}")
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


def get_current_user():
    return db.session.get(User, int(get_jwt_identity()))


def run_lstm_for_barangay(barangay, city, target_diseases, forecast_months,
                           df_merged=None):
    """
    Run LSTM for a single barangay.
    Returns (diseases, predictions_dict, historical_dict, forecast_dates).
    """
    if df_merged is None:
        aggregated = get_aggregated_data(city=city or None, barangay=barangay)
        if not aggregated:
            raise ValueError(f'No data found for barangay: {barangay}')
        df_merged = pd.DataFrame(aggregated)

    diseases = target_diseases or detect_disease_columns(df_merged)
    diseases = [d for d in diseases if d in df_merged.columns]
    if not diseases:
        raise ValueError('No valid disease columns found')

    processor = DataProcessor(sequence_length=app.config['SEQUENCE_LENGTH'])

    if barangay == '__ALL__':
        disease_cols = [c for c in diseases if c in df_merged.columns]
        df_merged = df_merged.groupby(['year', 'month'])[disease_cols].sum().reset_index()
        df_merged['barangay'] = 'All Barangays'
        df_merged['city']     = city or ''
        df_filtered = processor.load_and_filter_data_from_df(df_merged, 'All Barangays')
    else:
        df_filtered = processor.load_and_filter_data_from_df(df_merged, barangay)

    scaled_data, feature_cols = processor.prepare_features(df_filtered, diseases)
    target_indices = [feature_cols.index(col) for col in diseases]
    X, y = processor.create_sequences(scaled_data, target_indices)

    if len(X) < 20:
        raise ValueError('Not enough historical data (need at least 20 sequences)')

    forecaster = LSTMForecaster(
        sequence_length=app.config['SEQUENCE_LENGTH'],
        n_features=len(feature_cols),
        n_outputs=len(diseases)
    )
    forecaster.build_model()
    forecaster.train(X, y, epochs=app.config['EPOCHS'], batch_size=app.config['BATCH_SIZE'])

    last_sequence        = scaled_data.values[-app.config['SEQUENCE_LENGTH']:]
    predictions_scaled   = forecaster.forecast(last_sequence, n_months=forecast_months)
    predictions_original = processor.inverse_transform_predictions(predictions_scaled, diseases)

    last_date      = df_filtered['date'].max()
    forecast_dates = build_forecast_dates(last_date, forecast_months)

    predictions_dict = {d: clean_floats(predictions_original[d].tolist()) for d in diseases}
    historical_dict  = {
        'dates': df_filtered['date'].dt.strftime('%Y-%m').tolist(),
        **{d: clean_floats(df_filtered[d].fillna(0).tolist()) for d in diseases}
    }

    del df_filtered, scaled_data, X, y, forecaster
    gc.collect()

    return diseases, predictions_dict, historical_dict, forecast_dates


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'}), 200


@app.route('/api/barangays', methods=['POST'])
@jwt_required()
def get_barangays():
    current_user = get_current_user()
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

        is_morbidity = False
        try:
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
                preprocessor = SmartHealthPreprocessor()
                df_processed = preprocessor.process_file(filepath)
                df_processed = preprocessor.complete_time_series(df_processed)

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

        upload_record = UploadHistory(
            user_id=current_user.id, filename=filename, city=city or None,
            barangay_count=len(barangays), disease_count=len(disease_columns),
            date_range_start=start_date or None, date_range_end=end_date or None,
            status='success',
        )
        db.session.add(upload_record)
        db.session.commit()

        BATCH = 500
        if is_morbidity and db_records:
            col_map = BarangayData.AGE_SEX_COL_MAP
            rows = []
            for rec in db_records:
                kwargs = dict(
                    upload_id=upload_record.id, city=rec.get('city') or city or None,
                    barangay=rec['barangay'], year=rec['year'], month=rec['month'],
                    disease_category=rec['disease_category'], disease_label=rec['disease_label'],
                    total_male=rec.get('total_male', 0), total_female=rec.get('total_female', 0),
                    total_cases=rec.get('total_cases', 0),
                )
                for src_col, attr in col_map.items():
                    kwargs[attr] = rec.get(src_col)
                rows.append(BarangayData(**kwargs))
            for i in range(0, len(rows), BATCH):
                db.session.bulk_save_objects(rows[i:i+BATCH])
                db.session.commit()
            print(f"   💾 {len(rows)} morbidity records saved to DB")

        elif 'barangay' in df_processed.columns and 'year' in df_processed.columns:
            rows = []
            for _, row in df_processed.iterrows():
                brgy  = str(row['barangay']).strip()
                year  = int(row['year'])
                month = int(row['month'])
                for disease in disease_columns:
                    count = int(row[disease]) if pd.notna(row.get(disease)) else 0
                    cat_key = disease.replace('_cases', '')
                    rows.append(BarangayData(
                        upload_id=upload_record.id, city=city or None,
                        barangay=brgy, year=year, month=month,
                        disease_category=cat_key,
                        disease_label=cat_key.replace('_', ' ').title(),
                        total_male=0, total_female=0, total_cases=count,
                    ))
            for i in range(0, len(rows), BATCH):
                db.session.bulk_save_objects(rows[i:i+BATCH])
                db.session.commit()
            print(f"   💾 {len(rows)} standard records saved to DB")

        del df_processed
        gc.collect()

        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except (PermissionError, FileNotFoundError, OSError):
            pass

        return jsonify({
            'barangays': barangays, 'disease_columns': disease_columns,
            'city': city, 'city_detected': city_detected,
            'start_date': start_date, 'end_date': end_date,
            'upload_id': upload_record.id, 'is_morbidity': is_morbidity,
        }), 200

    except Exception as e:
        if current_user:
            try:
                db.session.add(UploadHistory(
                    user_id=current_user.id, filename=file.filename,
                    status='failed', error_msg=str(e),
                ))
                db.session.commit()
            except Exception:
                db.session.rollback()
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except (PermissionError, FileNotFoundError, OSError):
                pass
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/climate', methods=['GET'])
@jwt_required()
def get_climate():
    import requests as req
    city       = request.args.get('city', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date   = request.args.get('end_date', '').strip()

    if not city:
        return jsonify({'error': 'City name is required.', 'needs_city_input': True}), 400
    if not start_date or not end_date:
        return jsonify({'error': 'start_date and end_date are required'}), 400

    try:
        geo_url  = 'https://geocoding-api.open-meteo.com/v1/search'
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
            return jsonify({'error': f"Could not find coordinates for '{city}'.", 'needs_city_input': True}), 404

        lat           = geo_data['results'][0]['latitude']
        lng           = geo_data['results'][0]['longitude']
        resolved_city = geo_data['results'][0].get('name', city)

        climate_res  = req.get('https://archive-api.open-meteo.com/v1/archive', params={
            'latitude': lat, 'longitude': lng,
            'start_date': start_date, 'end_date': end_date,
            'monthly': 'temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean',
            'timezone': 'Asia/Manila',
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

        return jsonify({'city': resolved_city, 'lat': lat, 'lng': lng, 'records': records}), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast-from-db', methods=['POST'])
@jwt_required()
def forecast_from_db():
    current_user = get_current_user()
    data = request.get_json() or {}

    barangay        = data.get('barangay', '')
    target_diseases = data.get('diseases', [])
    forecast_months = int(data.get('forecast_months', 6))
    city            = data.get('city', '')

    if not barangay:
        return jsonify({'error': 'Barangay not specified'}), 400

    try:
        diseases, predictions_dict, historical_dict, forecast_dates = run_lstm_for_barangay(
            barangay, city, target_diseases, forecast_months
        )

        record = save_forecast_flat(
            user_id=current_user.id, city=city, barangay=barangay,
            diseases=diseases, forecast_months=forecast_months,
            forecast_dates=forecast_dates,
            predictions_dict=predictions_dict, historical_dict=historical_dict,
        )
        print(f"   💾 Forecast saved (id={record.id})")

        return jsonify({
            'barangay':        barangay, 'city': city,
            'forecast_dates':  forecast_dates,
            'disease_columns': diseases,
            'predictions':     predictions_dict,
            'historical_data': historical_dict,
            'forecast_id':     record.id,
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast-all', methods=['POST'])
@jwt_required()
def forecast_all():
    current_user = get_current_user()
    data = request.get_json() or {}

    forecast_months = int(data.get('forecast_months', 6))
    city            = data.get('city', '')
    target_diseases = data.get('diseases', [])

    try:
        barangays_q = db.session.query(BarangayData.barangay).distinct()
        if city:
            barangays_q = barangays_q.filter(BarangayData.city.ilike(f'%{city}%'))
        barangays = [r.barangay for r in barangays_q.all() if r.barangay]

        if not barangays:
            return jsonify({'error': 'No barangays found in database.'}), 404

        print(f"🚀 Starting forecast-all for {len(barangays)} barangays...")
        results = []
        failed  = []

        for brgy in barangays:
            try:
                print(f"🧠 Training for: {brgy}")
                diseases, predictions_dict, historical_dict, forecast_dates = \
                    run_lstm_for_barangay(brgy, city, target_diseases, forecast_months)

                record = save_forecast_flat(
                    user_id=current_user.id, city=city, barangay=brgy,
                    diseases=diseases, forecast_months=forecast_months,
                    forecast_dates=forecast_dates,
                    predictions_dict=predictions_dict, historical_dict=historical_dict,
                )

                results.append({'barangay': brgy, 'forecast_id': record.id,
                                'forecast_dates': forecast_dates})
                print(f"   ✅ Done: {brgy}")

            except Exception as e:
                db.session.rollback()
                failed.append({'barangay': brgy, 'reason': str(e)})
                print(f"   ❌ Failed: {brgy} — {e}")
                continue

        print(f"✅ forecast-all complete | Done: {len(results)} | Failed: {len(failed)}")
        return jsonify({
            'success':        True,
            'total':          len(barangays),
            'completed':      len(results),
            'failed':         len(failed),
            'failed_details': failed,
            'results':        results,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast-saved', methods=['GET'])
@jwt_required()
def get_saved_forecast():
    barangay = request.args.get('barangay', '').strip()
    city     = request.args.get('city', '').strip()

    if not barangay:
        return jsonify({'error': 'barangay is required'}), 400

    try:
        if barangay == '__ALL__':
            result = get_all_saved_forecast_dict(city=city or None)
            if not result:
                return jsonify({'error': 'No saved forecasts found.', 'not_found': True}), 404
            return jsonify(result), 200
        else:
            result = get_saved_forecast_dict(barangay=barangay, city=city or None)
            if not result:
                return jsonify({
                    'error': f'No saved forecast for {barangay}. Please run Generate All first.',
                    'not_found': True,
                }), 404
            return jsonify(result), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecasts', methods=['GET'])
@jwt_required()
def get_my_forecasts():
    u = get_current_user()
    q = Forecast.query if u.role == 'admin' else Forecast.query.filter_by(user_id=u.id)
    return jsonify([f.to_dict() for f in q.order_by(Forecast.created_at.desc()).limit(50).all()]), 200


@app.route('/api/forecasts/<int:fid>', methods=['GET'])
@jwt_required()
def get_forecast(fid):
    u = get_current_user()
    f = Forecast.query.get_or_404(fid)
    if f.user_id != u.id and u.role != 'admin':
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(f.to_api_dict()), 200


@app.route('/api/disease-breakdown', methods=['GET'])
@jwt_required()
def disease_breakdown():
    from sqlalchemy import func
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
        ).filter(BarangayData.disease_category == category)

        if barangay and barangay != '__ALL__':
            q = q.filter(BarangayData.barangay.ilike(barangay))
        if city:
            q = q.filter(BarangayData.city.ilike(f'%{city}%'))

        q = q.group_by(
            BarangayData.disease_label, BarangayData.disease_category,
        ).order_by(func.sum(BarangayData.total_cases).desc()).limit(top_n)

        rows = q.all()

        monthly_trend = []
        if rows:
            top_label = rows[0].disease_label
            trend_q = db.session.query(
                BarangayData.year, BarangayData.month,
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
            'category': category, 'barangay': barangay,
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


@app.route('/api/dataset-info', methods=['GET'])
@jwt_required()
def dataset_info():
    city = request.args.get('city', '').strip()
    try:
        q = db.session.query(
            BarangayData.barangay, BarangayData.city, BarangayData.disease_category,
        ).distinct()
        if city:
            q = q.filter(BarangayData.city.ilike(f'%{city}%'))
        rows = q.all()

        if not rows:
            return jsonify({'barangays': [], 'disease_columns': [], 'city': '',
                            'has_saved_forecasts': False}), 200

        barangays           = sorted(set(r.barangay for r in rows if r.barangay))
        diseases            = sorted(set(f"{r.disease_category}_cases"
                                        for r in rows if r.disease_category))
        city_val            = rows[0].city or ''
        has_saved_forecasts = Forecast.query.first() is not None

        return jsonify({
            'barangays':           barangays,
            'disease_columns':     diseases,
            'city':                city_val,
            'has_saved_forecasts': has_saved_forecasts,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/age-sex-breakdown', methods=['GET'])
@jwt_required()
def age_sex_breakdown():
    """
    Returns age/sex breakdown for a disease category and barangay.
    Used by Prediction page charts.
    """
    from sqlalchemy import func

    category = request.args.get('category', '').strip()
    barangay = request.args.get('barangay', '__ALL__').strip()
    city     = request.args.get('city', '').strip()

    if not category:
        return jsonify({'error': 'category is required'}), 400

    try:
        age_cols = {
            'under1':    ('under1_m',    'under1_f'),
            '1-4':       ('age_1_4_m',   'age_1_4_f'),
            '5-9':       ('age_5_9_m',   'age_5_9_f'),
            '10-14':     ('age_10_14_m', 'age_10_14_f'),
            '15-19':     ('age_15_19_m', 'age_15_19_f'),
            '20-24':     ('age_20_24_m', 'age_20_24_f'),
            '25-29':     ('age_25_29_m', 'age_25_29_f'),
            '30-34':     ('age_30_34_m', 'age_30_34_f'),
            '35-39':     ('age_35_39_m', 'age_35_39_f'),
            '40-44':     ('age_40_44_m', 'age_40_44_f'),
            '45-49':     ('age_45_49_m', 'age_45_49_f'),
            '50-54':     ('age_50_54_m', 'age_50_54_f'),
            '55-59':     ('age_55_59_m', 'age_55_59_f'),
            '60-64':     ('age_60_64_m', 'age_60_64_f'),
            '65+':       ('age_65above_m','age_65above_f'),
        }

        q = db.session.query(BarangayData).filter(
            BarangayData.disease_category == category
        )
        if barangay and barangay != '__ALL__':
            q = q.filter(BarangayData.barangay.ilike(barangay))
        if city:
            q = q.filter(BarangayData.city.ilike(f'%{city}%'))

        rows = q.all()

        # Aggregate age/sex totals
        totals = {group: {'male': 0, 'female': 0} for group in age_cols}
        total_male = total_female = 0

        for row in rows:
            for group, (m_col, f_col) in age_cols.items():
                m_val = getattr(row, m_col) or 0
                f_val = getattr(row, f_col) or 0
                totals[group]['male']   += m_val
                totals[group]['female'] += f_val
                total_male   += m_val
                total_female += f_val

        breakdown = [
            {
                'age_group': group,
                'male':      totals[group]['male'],
                'female':    totals[group]['female'],
                'total':     totals[group]['male'] + totals[group]['female'],
            }
            for group in age_cols
        ]

        return jsonify({
            'category':     category,
            'barangay':     barangay,
            'total_male':   total_male,
            'total_female': total_female,
            'total_cases':  total_male + total_female,
            'breakdown':    breakdown,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db(app)
    print("🚀 Starting PredictHealth Backend...")
    print("📍 Server running on http://localhost:5000")
    print("📊 Ready to receive forecast requests!")
    print("🔓 CORS enabled for frontend access")
    app.run(debug=True, host='0.0.0.0', port=5000)