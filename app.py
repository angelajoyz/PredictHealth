from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from werkzeug.utils import secure_filename
import gc

from config import Config
from models.data_processor import DataProcessor
from models.lstm_model import LSTMForecaster

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
    with pd.ExcelFile(file_path) as xl:
        sheets = xl.sheet_names

        if 'Unified_Data' in sheets:
            df = pd.read_excel(xl, sheet_name='Unified_Data')
            if 'Health_Data' in sheets:
                df_health = pd.read_excel(xl, sheet_name='Health_Data')
                new_cols = [c for c in df_health.columns
                            if c.endswith('_cases') and c not in df.columns]
                if new_cols:
                    merge_keys = [k for k in ['city', 'barangay', 'year', 'month']
                                  if k in df.columns and k in df_health.columns]
                    df = df.merge(df_health[merge_keys + new_cols], on=merge_keys, how='left')

        elif 'Health_Data' in sheets:
            df = pd.read_excel(xl, sheet_name='Health_Data')
            for sheet in ['Climate_Data', 'Environmental_Data']:
                if sheet in sheets:
                    other = pd.read_excel(xl, sheet_name=sheet)
                    merge_keys = [k for k in ['city', 'barangay', 'year', 'month']
                                  if k in df.columns and k in other.columns]
                    df = df.merge(other, on=merge_keys, how='left')

        else:
            df = pd.read_excel(xl, sheet_name=0)

    return df


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'}), 200


@app.route('/api/barangays', methods=['POST'])
def get_barangays():
    """Get barangays, disease columns, city, and dataset date range from uploaded file"""
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

        with pd.ExcelFile(filepath) as xl:
            sheets = xl.sheet_names
            if 'Health_Data' in sheets:
                df_source = pd.read_excel(xl, sheet_name='Health_Data')
            elif 'Unified_Data' in sheets:
                df_source = pd.read_excel(xl, sheet_name='Unified_Data')
            else:
                df_source = pd.read_excel(xl, sheet_name=0)

        barangays       = sorted(df_source['barangay'].dropna().unique().tolist())
        disease_columns = detect_disease_columns(df_source)

        # ✅ Extract city
        city = ''
        if 'city' in df_source.columns:
            city_vals = df_source['city'].dropna()
            if not city_vals.empty:
                city = str(city_vals.iloc[0])

        # ✅ Extract dataset date range (used by frontend to call /api/climate)
        start_date = ''
        end_date   = ''
        if 'year' in df_source.columns and 'month' in df_source.columns:
            df_source['_date'] = pd.to_datetime(
                df_source['year'].astype(str) + '-' +
                df_source['month'].astype(str).str.zfill(2) + '-01'
            )
            start_date = df_source['_date'].min().strftime('%Y-%m-%d')
            end_date   = df_source['_date'].max().strftime('%Y-%m-%d')

        del df_source
        gc.collect()

        print(f"✅ Barangays: {len(barangays)} | Diseases: {disease_columns} | City: {city} | Range: {start_date} → {end_date}")

        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"✅ Cleaned up file: {filepath}")
        except (PermissionError, FileNotFoundError, OSError) as e:
            print(f"⚠️ Could not delete {filepath}: {e}")

        return jsonify({
            'barangays':       barangays,
            'disease_columns': disease_columns,
            'city':            city,
            'start_date':      start_date,   # ✅ NEW
            'end_date':        end_date,     # ✅ NEW
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
    """
    Fetch real historical climate data from Open-Meteo
    for the city and date range of the uploaded dataset.

    Query params:
        city       — city name from dataset (e.g. "Las Piñas")
        start_date — YYYY-MM-DD (first month of dataset)
        end_date   — YYYY-MM-DD (last month of dataset)
    """
    import requests as req

    city       = request.args.get('city', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date   = request.args.get('end_date', '').strip()

    if not city or not start_date or not end_date:
        return jsonify({'error': 'city, start_date, and end_date are required'}), 400

    try:
        # ── Step 1: Geocoding — city name → lat/lng ──────────────────
        geo_url = 'https://geocoding-api.open-meteo.com/v1/search'
        geo_res = req.get(geo_url, params={
            'name':         city,
            'count':        1,
            'language':     'en',
            'format':       'json',
            'country_code': 'PH',
        }, timeout=10)
        geo_data = geo_res.json()

        if not geo_data.get('results'):
            # Fallback: try without country filter
            geo_res = req.get(geo_url, params={
                'name':     city,
                'count':    1,
                'language': 'en',
                'format':   'json',
            }, timeout=10)
            geo_data = geo_res.json()

        if not geo_data.get('results'):
            return jsonify({'error': f'Could not find coordinates for city: {city}'}), 404

        lat           = geo_data['results'][0]['latitude']
        lng           = geo_data['results'][0]['longitude']
        resolved_city = geo_data['results'][0].get('name', city)
        print(f"📍 Geocoded '{city}' → {resolved_city} ({lat}, {lng})")

        # ── Step 2: Historical monthly climate data ───────────────────
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
                'month':       t[:7],  # YYYY-MM
                'temperature': round(temps[i], 1) if i < len(temps) and temps[i] is not None else None,
                'rainfall':    round(rain[i],  1) if i < len(rain)  and rain[i]  is not None else None,
                'humidity':    round(humid[i], 1) if i < len(humid) and humid[i] is not None else None,
            })

        print(f"✅ Climate data fetched: {len(records)} months for {resolved_city}")

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
    """Main forecasting endpoint"""
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

        df_merged       = load_and_merge_sheets(filepath)

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
        print(f"📅 Last historical date: {last_date.strftime('%Y-%m-%d')}")

        forecast_dates = [
            (last_date + relativedelta(months=i+1)).strftime('%Y-%m')
            for i in range(forecast_months)
        ]
        print(f"📅 Forecast dates: {forecast_dates}")

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
                print(f"✅ Cleaned up file: {filepath}")
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
        print(f"Error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("🚀 Starting PredictHealth Backend...")
    print("📍 Server running on http://localhost:5000")
    print("📊 Ready to receive forecast requests!")
    print("🔓 CORS enabled for frontend access")
    app.run(debug=True, host='0.0.0.0', port=5000)
