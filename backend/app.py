# ── Memory & Threading optimizations (MUST be before any TF import) ──────────
import os
import threading

os.environ['TF_CPP_MIN_LOG_LEVEL']      = '3'
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
os.environ['OMP_NUM_THREADS']           = '1'
os.environ['TF_NUM_INTEROP_THREADS']    = '1'
os.environ['TF_NUM_INTRAOP_THREADS']    = '1'

# Global semaphore — only ONE forecast can run at a time.
# Prevents OOM crashes when multiple requests hit simultaneously
# (e.g. a ping while a forecast is already running).
_forecast_lock = threading.Semaphore(1)

# ─────────────────────────────────────────────────────────────────────────────

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from dotenv import load_dotenv
import re
import hashlib
import pickle
import pandas as pd
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from werkzeug.utils import secure_filename
import gc
import warnings

# Suppress TensorFlow and Keras warnings
warnings.filterwarnings('ignore', category=UserWarning)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

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
load_dotenv()
app.config.from_object(Config)

from flask_mail import Mail

db.init_app(app)
jwt = JWTManager(app)
mail = Mail(app)

# ── Pre-warm TensorFlow on startup (eliminates cold-start delay per barangay) ──
def _warm_up_tensorflow():
    try:
        import numpy as np
        from models.lstm_model import LSTMForecaster
        print("🔥 Warming up TensorFlow...")
        dummy = LSTMForecaster(sequence_length=6, n_features=3, n_outputs=1)
        dummy.build_model()
        dummy_X = np.zeros((1, 6, 3))
        dummy.model.predict(dummy_X, verbose=0)
        del dummy
        import gc; gc.collect()
        print("✅ TensorFlow warmed up")
    except Exception as e:
        print(f"⚠️ TF warm-up failed: {e}")

with app.app_context():
    _warm_up_tensorflow()

CORS(app, resources={
    r"/api/public/*": {
        "origins": "*",
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": False,
    },
    r"/api/*": {
        "origins": [
            "https://predict-health.vercel.app",
            "http://localhost:5173",
            "http://localhost:3000",
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
    },
})
app.register_blueprint(auth_bp,  url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

@app.after_request
def after_request(response):
    return response

# ── JWT error handlers — return 401 JSON instead of default HTML ──────────────
@jwt.unauthorized_loader
def unauthorized_callback(reason):
    return jsonify({'error': 'Not logged in. Please log in first.', 'code': 'UNAUTHORIZED'}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Session expired. Please log in again.', 'code': 'TOKEN_EXPIRED'}), 401

@jwt.invalid_token_loader
def invalid_token_callback(reason):
    return jsonify({'error': 'Invalid token. Please log in again.', 'code': 'INVALID_TOKEN'}), 401

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
    """Start forecasting from the month after the last available historical date."""
    if isinstance(last_date, str):
        try:
            last_date = datetime.strptime(last_date[:10], '%Y-%m-%d').date()
        except Exception:
            last_date = date.today()
    elif isinstance(last_date, datetime):
        last_date = last_date.date()
    elif not isinstance(last_date, date):
        last_date = date.today()

    reference = datetime(last_date.year, last_date.month, 1) + relativedelta(months=1)
    return [
        (reference + relativedelta(months=i)).strftime('%Y-%m')
        for i in range(forecast_months)
    ]


def save_forecast_flat(user_id, city, barangay, diseases, forecast_months,
                       forecast_dates, predictions_dict, historical_dict):
    """
    Save forecast header + flat ForecastResult rows.

    Only delete the existing forecast for THIS barangay that belongs to the
    SAME forecast year (i.e. same year prefix in forecast_dates).
    Forecasts from previous years are kept intact so historical year data
    remains viewable in the frontend year selector.

    Two types of rows are stored:
      1. Forecast rows   — forecast_period set,   historical_period = NULL
      2. Historical rows — historical_period set, forecast_period   = NULL
    """
    forecast_year_prefix = forecast_dates[0][:4] if forecast_dates else None

    old = Forecast.query.filter_by(barangay=barangay, city=city or None).all()
    for o in old:
        if forecast_year_prefix and o.forecast_dates:
            same_year = any(d.startswith(forecast_year_prefix) for d in o.forecast_dates)
            if same_year:
                db.session.delete(o)
        else:
            db.session.delete(o)
    db.session.flush()

    record = Forecast(
        user_id         = user_id,
        city            = city or None,
        barangay        = barangay,
        diseases        = diseases,
        forecast_months = forecast_months,
        forecast_dates  = forecast_dates,
    )
    db.session.add(record)
    db.session.flush()

    hist_dates = historical_dict.get('dates', [])
    rows = []

    for disease_col in diseases:
        cat_key   = disease_col.replace('_cases', '')
        pred_vals = predictions_dict.get(disease_col, [])
        hist_vals = historical_dict.get(disease_col, [])

        for i, period in enumerate(forecast_dates):
            predicted = float(pred_vals[i]) if i < len(pred_vals) else 0.0
            rows.append(ForecastResult(
                forecast_id       = record.id,
                city              = city or None,
                barangay          = barangay,
                disease_category  = cat_key,
                disease_label     = cat_key.replace('_', ' ').title(),
                forecast_period   = period,
                predicted_cases   = predicted,
                historical_period = None,
                historical_cases  = None,
            ))

        for j, hperiod in enumerate(hist_dates):
            hval = float(hist_vals[j]) if j < len(hist_vals) else 0.0
            rows.append(ForecastResult(
                forecast_id       = record.id,
                city              = city or None,
                barangay          = barangay,
                disease_category  = cat_key,
                disease_label     = cat_key.replace('_', ' ').title(),
                forecast_period   = None,
                predicted_cases   = 0.0,
                historical_period = hperiod,
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


def _make_cache_key(barangay, city, diseases):
    key_str = f"{barangay}|{city}|{','.join(sorted(diseases))}"
    return hashlib.sha256(key_str.encode()).hexdigest()[:16]


def _get_cache_paths(cache_key):
    folder = app.config['MODEL_FOLDER']
    return (
        os.path.join(folder, f'{cache_key}.keras'),
        os.path.join(folder, f'{cache_key}_meta.pkl'),
    )


def _clear_model_cache():
    # Clear disk cache
    folder = app.config['MODEL_FOLDER']
    for fname in os.listdir(folder):
        try:
            os.remove(os.path.join(folder, fname))
        except Exception:
            pass
    # Also clear in-memory cache so stale models are not reused after new upload
    _model_memory_cache.clear()
    print("   🗑️  Model cache cleared (disk + memory)")


# In-memory cache: cache_key → dict with forecaster + meta
# Survives across requests within the same Render worker process.
# Wiped automatically on new file upload via _clear_model_cache().
_model_memory_cache = {}


def run_lstm_for_barangay(barangay, city, target_diseases, forecast_months,
                           df_merged=None):
    if df_merged is None:
        aggregated = get_aggregated_data(city=city or None, barangay=barangay)
        if not aggregated:
            raise ValueError(f'No data found for barangay: {barangay}')
        df_merged = pd.DataFrame(aggregated)

    diseases = target_diseases or detect_disease_columns(df_merged)
    diseases = [d for d in diseases if d in df_merged.columns]
    if not diseases:
        raise ValueError('No valid disease columns found')

    cache_key = _make_cache_key(barangay, city, diseases)
    model_path, meta_path = _get_cache_paths(cache_key)

    # ── 1. In-memory cache (fastest — no disk I/O, no model reload) ──────────
    if cache_key in _model_memory_cache:
        try:
            print(f"   ⚡⚡ Memory cache hit for {barangay}")
            cached = _model_memory_cache[cache_key]

            processor = DataProcessor(sequence_length=app.config['SEQUENCE_LENGTH'])
            processor.scalers = cached['scalers']

            predictions_scaled   = cached['forecaster'].forecast(
                cached['last_sequence'], n_months=forecast_months
            )
            predictions_original = processor.inverse_transform_predictions(
                predictions_scaled, diseases
            )

            forecast_dates   = build_forecast_dates(cached['last_date'], forecast_months)
            predictions_dict = {
                d: clean_floats(predictions_original[d].tolist()) for d in diseases
            }
            return diseases, predictions_dict, cached['historical_dict'], forecast_dates
        except Exception as e:
            print(f"   ⚠️  Memory cache failed ({e}) — falling back to disk")
            _model_memory_cache.pop(cache_key, None)

    # ── 2. Disk cache (fast — no retraining, just reload weights) ────────────
    if os.path.exists(model_path) and os.path.exists(meta_path):
        try:
            print(f"   ⚡ Disk cache hit — loading trained model for {barangay}")
            with open(meta_path, 'rb') as f:
                meta = pickle.load(f)

            forecaster = LSTMForecaster(
                sequence_length=app.config['SEQUENCE_LENGTH'],
                n_features=meta['n_features'],
                n_outputs=len(diseases)
            )
            forecaster.load_model(model_path)

            # Promote to memory cache so next request is instant
            _model_memory_cache[cache_key] = {
                'forecaster':      forecaster,
                'scalers':         meta['scalers'],
                'last_sequence':   meta['last_sequence'],
                'last_date':       meta['last_date'],
                'historical_dict': meta['historical_dict'],
            }

            processor = DataProcessor(sequence_length=app.config['SEQUENCE_LENGTH'])
            processor.scalers = meta['scalers']

            predictions_scaled   = forecaster.forecast(
                meta['last_sequence'], n_months=forecast_months
            )
            predictions_original = processor.inverse_transform_predictions(
                predictions_scaled, diseases
            )

            forecast_dates   = build_forecast_dates(meta['last_date'], forecast_months)
            predictions_dict = {
                d: clean_floats(predictions_original[d].tolist()) for d in diseases
            }
            return diseases, predictions_dict, meta['historical_dict'], forecast_dates

        except Exception as e:
            print(f"   ⚠️  Disk cache load failed ({e}) — retraining")
            _model_memory_cache.pop(cache_key, None)

    # ── 3. Full retrain (slowest — only on first run or cache miss) ───────────
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
    
    # ✅ FIX: Improved training with patience and validation split
    forecaster.train(
        X, y, 
        epochs=app.config['EPOCHS'], 
        batch_size=app.config['BATCH_SIZE'],
        validation_split=0.1,
        patience=15  # Increased from default
    )

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

    # Save to disk cache
    try:
        forecaster.save_model(model_path)
        with open(meta_path, 'wb') as f:
            pickle.dump({
                'n_features':      len(feature_cols),
                'scalers':         processor.scalers,
                'last_sequence':   last_sequence,
                'last_date':       last_date,
                'historical_dict': historical_dict,
                'feature_cols':    feature_cols,
            }, f)
        print(f"   💾 Model cached to disk for {barangay}")
    except Exception as e:
        print(f"   ⚠️  Failed to cache model to disk: {e}")

    # Promote to memory cache (don't del forecaster — keep it alive in cache)
    _model_memory_cache[cache_key] = {
        'forecaster':      forecaster,
        'scalers':         processor.scalers,
        'last_sequence':   last_sequence,
        'last_date':       last_date,
        'historical_dict': historical_dict,
    }
    print(f"   🧠 Model promoted to memory cache for {barangay}")

    del df_filtered, scaled_data, X, y
    gc.collect()

    return diseases, predictions_dict, historical_dict, forecast_dates


# ── KEEP-ALIVE PING (ultra-lightweight — no DB, no ML) ───────────────────────
# Use /api/ping for any external monitoring tool instead of /api/health.
# This wakes Render without touching any heavy resources.
@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'ok'}), 200


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'}), 200


@app.route('/api/check-filename', methods=['GET'])
@jwt_required()
def check_filename():
    current_user = get_current_user()
    filename = request.args.get('filename', '').strip()
    if not filename:
        return jsonify({'error': 'filename is required'}), 400

    secured = secure_filename(filename)
    existing = UploadHistory.query.filter_by(
        filename=secured, status='success'
    ).order_by(UploadHistory.uploaded_at.desc()).first()

    if not existing:
        return jsonify({'owned_by_current_user': False, 'owned_by_other_user': False}), 200
    if existing.user_id == current_user.id:
        return jsonify({'owned_by_current_user': True, 'owned_by_other_user': False}), 200
    return jsonify({'owned_by_current_user': False, 'owned_by_other_user': True}), 200


@app.route('/api/scan-file', methods=['POST'])
@jwt_required()
def scan_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file'}), 400

    filepath = None
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
            df_wide, _ = parse_morbidity_file(filepath)
            df_processed = df_wide
        else:
            try:
                preprocessor = UltimateAutoPreprocessor()
                df_processed = preprocessor.process_file(filepath)
                if hasattr(preprocessor, 'complete_time_series'):
                    df_processed = preprocessor.complete_time_series(df_processed)
                else:
                    smart = SmartHealthPreprocessor()
                    df_processed = smart.complete_time_series(df_processed)
            except Exception:
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

        del df_processed
        gc.collect()

        return jsonify({
            'barangays':       barangays,
            'disease_columns': disease_columns,
            'city':            city,
            'city_detected':   bool(city),
            'start_date':      start_date,
            'end_date':        end_date,
            'is_morbidity':    is_morbidity,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
    finally:
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass


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
        replace_mode = request.form.get('replace', 'false').lower() == 'true'
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        if replace_mode:
            deleted = BarangayData.query.delete()
            db.session.commit()
            print(f"   🗑️  Replace mode: deleted {deleted} old records")

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

        _clear_model_cache()

        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except (PermissionError, FileNotFoundError, OSError):
            pass

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
            'latitude':  lat, 'longitude': lng,
            'start_date': start_date, 'end_date': end_date,
            'monthly':   'temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean',
            'timezone':  'Asia/Manila',
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


# ── FORECAST FROM DB ──────────────────────────────────────────────────────────
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

    # Try to acquire the lock — if another forecast is already running, reject immediately
    acquired = _forecast_lock.acquire(blocking=False)
    if not acquired:
        return jsonify({
            'error': 'A forecast is already running. Please wait for it to finish before starting another.'
        }), 429

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
            'barangay':        barangay,
            'city':            city,
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

    finally:
        # ALWAYS release the lock — even if an exception occurred
        _forecast_lock.release()


# ── FORECAST ALL BARANGAYS ────────────────────────────────────────────────────
@app.route('/api/forecast-all', methods=['POST'])
@jwt_required()
def forecast_all():
    current_user = get_current_user()
    data = request.get_json() or {}

    forecast_months = int(data.get('forecast_months', 6))
    city            = data.get('city', '')
    target_diseases = data.get('diseases', [])

    # Try to acquire the lock — if another forecast is already running, reject immediately
    acquired = _forecast_lock.acquire(blocking=False)
    if not acquired:
        return jsonify({
            'error': 'A forecast is already running. Please wait for it to finish before starting another.'
        }), 429

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

    finally:
        # ALWAYS release the lock — even if an exception occurred
        _forecast_lock.release()


@app.route('/api/forecast-saved', methods=['GET'])
@jwt_required()
def get_saved_forecast():
    from sqlalchemy import func as sqlfunc
    barangay      = request.args.get('barangay', '').strip()
    city          = request.args.get('city', '').strip()
    forecast_year = request.args.get('forecast_year', '').strip()

    if not barangay:
        return jsonify({'error': 'barangay is required'}), 400

    try:
        if barangay == '__ALL__':
            result = get_all_saved_forecast_dict(city=city or None, forecast_year=forecast_year or None)
            if not result:
                return jsonify({'error': 'No saved forecasts found.', 'not_found': True}), 404
        else:
            result = get_saved_forecast_dict(barangay=barangay, city=city or None, forecast_year=forecast_year or None)
            if not result:
                return jsonify({
                    'error': f'No saved forecast for {barangay}. Please run Generate first.',
                    'not_found': True,
                }), 404

        fc_dates = result.get('forecast_dates', [])
        if fc_dates:
            year_str = fc_dates[0][:4]
            try:
                fc_year = int(year_str)
            except Exception:
                fc_year = None

            if fc_year:
                q = db.session.query(
                    BarangayData.year,
                    BarangayData.month,
                    BarangayData.disease_category,
                    sqlfunc.sum(BarangayData.total_cases).label('total'),
                ).filter(BarangayData.year == fc_year)

                if barangay != '__ALL__':
                    q = q.filter(BarangayData.barangay.ilike(barangay))
                if city:
                    q = q.filter(BarangayData.city.ilike(f'%{city}%'))

                q = q.group_by(
                    BarangayData.year,
                    BarangayData.month,
                    BarangayData.disease_category,
                ).order_by(BarangayData.year, BarangayData.month)

                rows = q.all()

                actual_map = {}
                for r in rows:
                    period = f"{r.year}-{str(r.month).zfill(2)}"
                    col = f"{r.disease_category}_cases"
                    if period not in actual_map:
                        actual_map[period] = {}
                    actual_map[period][col] = float(r.total or 0)

                diseases    = result.get('disease_columns', list(result.get('predictions', {}).keys()))
                actual_data = {'dates': fc_dates}
                for d in diseases:
                    vals = []
                    for period in fc_dates:
                        if period in actual_map:
                            val = actual_map[period].get(d, None)
                            vals.append(val)
                        else:
                            vals.append(None)
                    actual_data[d] = vals

                result['actual_data'] = actual_data

        return jsonify(result), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast-years', methods=['GET'])
@jwt_required()
def get_forecast_years():
    barangay = request.args.get('barangay', '').strip()
    city     = request.args.get('city', '').strip()

    try:
        q = Forecast.query
        if barangay and barangay != '__ALL__':
            q = q.filter(Forecast.barangay == barangay)
        if city:
            q = q.filter(Forecast.city.ilike(f'%{city}%'))

        all_forecasts = q.with_entities(Forecast.forecast_dates).all()

        years = set()
        for row in all_forecasts:
            if row.forecast_dates:
                for d in row.forecast_dates:
                    try:
                        years.add(int(d[:4]))
                    except Exception:
                        pass

        return jsonify({'years': sorted(years, reverse=True)}), 200

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

        from sqlalchemy import func as sqlfunc
        end_row = db.session.query(
            sqlfunc.max(BarangayData.year).label('max_year'),
        ).first()
        dataset_end_date = None
        if end_row and end_row.max_year:
            month_row = db.session.query(
                sqlfunc.max(BarangayData.month).label('max_month')
            ).filter(BarangayData.year == end_row.max_year).first()
            if month_row and month_row.max_month:
                dataset_end_date = f"{end_row.max_year}-{str(month_row.max_month).zfill(2)}-01"

        forecast_year = None
        if dataset_end_date:
            try:
                end_dt = datetime.strptime(dataset_end_date[:10], '%Y-%m-%d')
                forecast_year = end_dt.year + 1
            except Exception:
                pass

        forecasted_barangays = []
        if forecast_year:
            year_prefix   = str(forecast_year)
            all_forecasts = Forecast.query.with_entities(
                Forecast.barangay, Forecast.forecast_dates
            ).all()
            forecasted_barangays = list(set(
                f.barangay for f in all_forecasts
                if f.barangay and f.forecast_dates and
                any(d.startswith(year_prefix) for d in f.forecast_dates)
            ))

        all_forecast_years = set()
        all_year_records   = Forecast.query.with_entities(Forecast.forecast_dates).all()
        for row in all_year_records:
            if row.forecast_dates:
                for d in row.forecast_dates:
                    try:
                        all_forecast_years.add(int(d[:4]))
                    except Exception:
                        pass

        return jsonify({
            'barangays':                barangays,
            'disease_columns':          diseases,
            'city':                     city_val,
            'has_saved_forecasts':      has_saved_forecasts,
            'dataset_end_date':         dataset_end_date,
            'forecast_year':            forecast_year,
            'forecasted_barangays':     forecasted_barangays,
            'available_forecast_years': sorted(all_forecast_years, reverse=True),
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/barangay-data', methods=['GET'])
@jwt_required()
def get_barangay_data():
    from sqlalchemy import func

    upload_id = request.args.get('upload_id', type=int)
    if not upload_id:
        return jsonify({'error': 'upload_id is required'}), 400

    page     = request.args.get('page',     default=1,  type=int)
    per_page = request.args.get('per_page', default=20, type=int)
    per_page = min(per_page, 100)

    barangay_filter = request.args.get('barangay', '').strip()
    disease_filter  = request.args.get('disease',  '').strip()
    year_filter     = request.args.get('year',     type=int)
    month_filter    = request.args.get('month',    type=int)

    try:
        q = BarangayData.query.filter_by(upload_id=upload_id)

        if barangay_filter:
            q = q.filter(BarangayData.barangay.ilike(f'%{barangay_filter}%'))
        if disease_filter:
            q = q.filter(BarangayData.disease_category == disease_filter)
        if year_filter:
            q = q.filter(BarangayData.year == year_filter)
        if month_filter:
            q = q.filter(BarangayData.month == month_filter)

        q = q.order_by(BarangayData.barangay, BarangayData.year,
                       BarangayData.month, BarangayData.disease_category)

        total   = q.count()
        records = q.offset((page - 1) * per_page).limit(per_page).all()

        opts_q    = BarangayData.query.filter_by(upload_id=upload_id)
        barangays = [r[0] for r in opts_q.with_entities(BarangayData.barangay).distinct().order_by(BarangayData.barangay).all()]
        diseases  = [r[0] for r in opts_q.with_entities(BarangayData.disease_category).distinct().order_by(BarangayData.disease_category).all()]
        years     = [r[0] for r in opts_q.with_entities(BarangayData.year).distinct().order_by(BarangayData.year).all()]
        months    = [r[0] for r in opts_q.with_entities(BarangayData.month).distinct().order_by(BarangayData.month).all()]

        return jsonify({
            'total':    total,
            'page':     page,
            'per_page': per_page,
            'pages':    (total + per_page - 1) // per_page,
            'records':  [r.to_dict() for r in records],
            'filter_options': {
                'barangays': barangays,
                'diseases':  diseases,
                'years':     years,
                'months':    months,
            },
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload-history', methods=['GET'])
@jwt_required()
def get_upload_history():
    current_user = get_current_user()
    try:
        uploads = UploadHistory.query.filter_by(
            status='success'
        ).order_by(UploadHistory.uploaded_at.desc()).all()

        return jsonify([{
            'id':               u.id,
            'filename':         u.filename,
            'city':             u.city,
            'barangay_count':   u.barangay_count,
            'disease_count':    u.disease_count,
            'date_range_start': str(u.date_range_start) if u.date_range_start else None,
            'date_range_end':   str(u.date_range_end)   if u.date_range_end   else None,
            'status':           u.status,
            'error_msg':        u.error_msg,
            'uploaded_at':      u.uploaded_at.isoformat() if u.uploaded_at else None,
        } for u in uploads]), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload-history/<int:upload_id>', methods=['DELETE'])
@jwt_required()
def delete_upload_history(upload_id):
    current_user = get_current_user()
    try:
        upload = UploadHistory.query.get_or_404(upload_id)

        if upload.user_id != current_user.id and current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403

        BarangayData.query.filter_by(upload_id=upload_id).delete()

        forecasts = Forecast.query.filter_by(user_id=upload.user_id).all()
        for f in forecasts:
            ForecastResult.query.filter_by(forecast_id=f.id).delete()
            db.session.delete(f)

        db.session.delete(upload)
        db.session.commit()

        return jsonify({'message': 'Upload deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ── PUBLIC ENDPOINTS (no auth required) ──────────────────────────────────────

@app.route('/api/public/dataset-info', methods=['GET'])
def public_dataset_info():
    try:
        rows = db.session.query(
            BarangayData.barangay,
            BarangayData.city,
            BarangayData.disease_category,
        ).distinct().all()

        if not rows:
            return jsonify({
                'barangays': [], 'disease_columns': [],
                'city': '', 'has_saved_forecasts': False
            }), 200

        barangays       = sorted(set(r.barangay for r in rows if r.barangay))
        disease_columns = sorted(set(
            f"{r.disease_category}_cases"
            for r in rows if r.disease_category
        ))
        city_val  = rows[0].city or ''
        has_saved = Forecast.query.first() is not None

        return jsonify({
            'barangays':           barangays,
            'disease_columns':     disease_columns,
            'city':                city_val,
            'has_saved_forecasts': has_saved,
        }), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({
            'barangays': [], 'disease_columns': [],
            'city': '', 'has_saved_forecasts': False
        }), 200


@app.route('/api/public/forecast', methods=['GET'])
def public_forecast():
    try:
        barangay = request.args.get('barangay', '__ALL__').strip()

        if barangay == '__ALL__':
            result = get_all_saved_forecast_dict(city=None, forecast_year=None)
        else:
            result = get_saved_forecast_dict(
                barangay=barangay, city=None, forecast_year=None
            )

        if not result:
            return jsonify({'not_found': True}), 200

        barangay_rows = db.session.query(
            BarangayData.barangay
        ).distinct().order_by(BarangayData.barangay).all()
        result['barangays'] = [r.barangay for r in barangay_rows if r.barangay]
        result['not_found'] = False

        return jsonify(result), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'not_found': True, 'error': str(e)}), 200


@app.route('/api/public/disease-breakdown', methods=['GET'])
def public_disease_breakdown():
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
            BarangayData.disease_label,
            BarangayData.disease_category,
        ).order_by(func.sum(BarangayData.total_cases).desc()).limit(top_n)

        rows = q.all()

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
                {
                    'period': f"{r.year}-{str(r.month).zfill(2)}",
                    'cases':  int(r.cases or 0)
                }
                for r in trend_q.all()
            ]

        return jsonify({
            'category': category,
            'barangay': barangay,
            'breakdown': [
                {
                    'label':        r.disease_label or category.replace('_', ' ').title(),
                    'category':     r.disease_category,
                    'total_cases':  int(r.total_cases  or 0),
                    'total_male':   int(r.total_male   or 0),
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
    init_db(app)
    print("🚀 Starting PredictHealth Backend...")
    print("📍 Server running on http://localhost:5000")
    print("📊 Ready to receive forecast requests!")
    print("🔓 CORS enabled for frontend access")
    app.run(debug=True, host='0.0.0.0', port=5000)