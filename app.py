from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from werkzeug.utils import secure_filename
import gc

from config import Config
from models.data_processor import DataProcessor
from models.lstm_model import LSTMForecaster
from ultimate_auto_preprocessor import UltimateAutoPreprocessor  # ✅ UPDATED: Handles ALL formats
from smart_health_preprocessor import SmartHealthPreprocessor  # Keep for fallback
from barangay_city_detector import detect_city_from_barangays

app = Flask(__name__)
app.config.from_object(Config)

CORS(app)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['MODEL_FOLDER'], exist_ok=True)


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def detect_disease_columns(df):
    exclude = {'city', 'barangay', 'year', 'month', 'health_facilities_count'}
    return [col for col in df.columns if col.endswith('_cases') and col not in exclude]


def load_and_merge_sheets(file_path):
    """
    ✅ UPDATED: Use UltimateAutoPreprocessor to handle ANY file format
    Falls back to SmartHealthPreprocessor if ultimate fails
    """
    try:
        # Try ultimate preprocessor first (handles individual cases, long, wide, multi-barangay)
        print("   🔄 Using UltimateAutoPreprocessor...")
        preprocessor = UltimateAutoPreprocessor()
        df = preprocessor.process_file(file_path)
        
        # Complete time series (fill missing months/cells)
        if hasattr(preprocessor, 'complete_time_series'):
            df = preprocessor.complete_time_series(df)
        else:
            # Use SmartHealthPreprocessor's complete_time_series
            smart = SmartHealthPreprocessor()
            df = smart.complete_time_series(df)
        
        return df
        
    except Exception as e:
        print(f"   ⚠️ UltimateAutoPreprocessor failed: {e}")
        print(f"   🔄 Trying SmartHealthPreprocessor fallback...")
        
        try:
            # Fallback to SmartHealthPreprocessor
            preprocessor = SmartHealthPreprocessor()
            df = preprocessor.process_file(file_path)
            df = preprocessor.complete_time_series(df)
            return df
        except Exception as e2:
            print(f"   ⚠️ SmartHealthPreprocessor also failed: {e2}")
            print(f"   🔄 Final fallback: direct Excel read...")
            return pd.read_excel(file_path, sheet_name=0)


def resolve_city(df, filename=''):
    """
    Auto-detect city using 4-level priority:
      1. City column in file (not blank / not 'Unknown')
      2. Auto-detect from barangay names  ← MAIN NEW FEATURE
      3. Guess from filename
      4. Return '' so frontend can show a manual input
    """
    # ── Level 1: from file ──
    if 'city' in df.columns:
        city_vals = df['city'].dropna().astype(str)
        city_vals = city_vals[~city_vals.str.strip().str.lower().isin(['', 'unknown'])]
        if not city_vals.empty:
            city = city_vals.iloc[0].strip()
            print(f"   📍 City (from file): {city}")
            return city

    # ── Level 2: detect from barangay names ──
    if 'barangay' in df.columns:
        barangays = df['barangay'].dropna().unique().tolist()
        city = detect_city_from_barangays(barangays)
        if city:
            print(f"   📍 City (auto-detected from barangays): {city}")
            return city

    # ── Level 3: from filename ──
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


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'}), 200


@app.route('/api/barangays', methods=['POST'])
def get_barangays():
    """
    Returns: barangays, disease_columns, city (auto-detected), city_detected flag, date range.
    If city_detected=False, frontend should show a manual city input field.
    
    ✅ UPDATED: Uses UltimateAutoPreprocessor to handle individual case records and all other formats
    """
    filepath = None

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only .xlsx and .xls allowed'}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # ✅ UPDATED: Use ultimate preprocessor with fallback
        try:
            print("   🔄 Using UltimateAutoPreprocessor...")
            preprocessor = UltimateAutoPreprocessor()
            df_processed = preprocessor.process_file(filepath)
            
            # Complete time series
            if hasattr(preprocessor, 'complete_time_series'):
                df_processed = preprocessor.complete_time_series(df_processed)
            else:
                smart = SmartHealthPreprocessor()
                df_processed = smart.complete_time_series(df_processed)
                
        except Exception as e:
            print(f"   ⚠️ UltimateAutoPreprocessor failed: {e}")
            print(f"   🔄 Fallback to SmartHealthPreprocessor...")
            preprocessor = SmartHealthPreprocessor()
            df_processed = preprocessor.process_file(filepath)
            df_processed = preprocessor.complete_time_series(df_processed)

        # ── Barangays ──
        if 'barangay' in df_processed.columns:
            barangays = sorted(df_processed['barangay'].dropna().unique().tolist())
        else:
            barangays = ['Unknown']

        # ── Disease columns ──
        disease_columns = [c for c in df_processed.columns if c.endswith('_cases')]

        # ── City: 4-level auto-detection ✅ ──
        city = resolve_city(df_processed, filename)
        city_detected = bool(city)

        # ── Date range ──
        start_date = end_date = ''
        if 'year' in df_processed.columns and 'month' in df_processed.columns:
            df_processed['_date'] = pd.to_datetime(
                df_processed['year'].astype(str) + '-' +
                df_processed['month'].astype(str).str.zfill(2) + '-01',
                errors='coerce'
            )
            df_processed = df_processed.dropna(subset=['_date'])
            if not df_processed.empty:
                start_date = df_processed['_date'].min().strftime('%Y-%m-%d')
                end_date   = df_processed['_date'].max().strftime('%Y-%m-%d')

        del df_processed
        gc.collect()

        print(f"✅ Barangays: {len(barangays)} | Diseases: {disease_columns} | "
              f"City: '{city}' (detected={city_detected}) | Range: {start_date} → {end_date}")

        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except (PermissionError, FileNotFoundError, OSError) as e:
            print(f"⚠️ Could not delete {filepath}: {e}")

        return jsonify({
            'barangays':       barangays,
            'disease_columns': disease_columns,
            'city':            city,
            'city_detected':   city_detected,
            'start_date':      start_date,
            'end_date':        end_date,
        }), 200

    except Exception as e:
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except (PermissionError, FileNotFoundError, OSError):
                pass
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/climate', methods=['GET'])
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
def forecast():
    """
    ✅ UPDATED: Uses load_and_merge_sheets with UltimateAutoPreprocessor
    """
    filepath = None

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    barangay        = request.form.get('barangay')
    target_diseases = request.form.getlist('diseases')
    forecast_months = int(request.form.get('forecast_months', 6))

    if not barangay:
        return jsonify({'error': 'Barangay not specified'}), 400

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # ✅ UPDATED: Uses UltimateAutoPreprocessor via load_and_merge_sheets
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

        last_date = df_filtered['date'].max()
        forecast_dates = [
            (last_date + relativedelta(months=i+1)).strftime('%Y-%m')
            for i in range(forecast_months)
        ]

        forecast_data = {
            'barangay':        barangay,
            'forecast_dates':  forecast_dates,
            'disease_columns': target_diseases,
            'predictions': {
                disease: predictions_original[disease].tolist()
                for disease in target_diseases
            },
            'historical_data': {
                'dates': df_filtered['date'].dt.strftime('%Y-%m').tolist(),
                **{disease: df_filtered[disease].tolist() for disease in target_diseases}
            }
        }

        del df_filtered, scaled_data, X, y, forecaster
        gc.collect()

        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except (PermissionError, FileNotFoundError, OSError) as e:
            print(f"⚠️ Could not delete {filepath}: {e}")

        print(f"✅ Forecast completed for {barangay}")
        return jsonify(forecast_data), 200

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


if __name__ == '__main__':
    print("🚀 Starting PredictHealth Backend...")
    print("📍 Server running on http://localhost:5000")
    print("📊 Ready to receive forecast requests!")
    print("🔓 CORS enabled for frontend access")
    app.run(debug=True, host='0.0.0.0', port=5000)