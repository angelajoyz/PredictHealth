from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pandas as pd
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import gc

from config import Config
from models.data_processor import DataProcessor
from models.lstm_model import LSTMForecaster

app = Flask(__name__)
app.config.from_object(Config)

# ✅ CORS FIX
CORS(app)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Create necessary folders
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['MODEL_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def detect_disease_columns(df):
    """
    Dynamically detect disease columns from a dataframe.
    Only picks columns ending with _cases — excludes metadata columns.
    """
    exclude = {'city', 'barangay', 'year', 'month', 'health_facilities_count'}
    return [col for col in df.columns if col.endswith('_cases') and col not in exclude]

def load_and_merge_sheets(file_path):
    """
    Load all sheets and merge into one unified DataFrame.
    Uses context manager to ensure file is properly closed.
    """
    with pd.ExcelFile(file_path) as xl:
        sheets = xl.sheet_names

        if 'Unified_Data' in sheets:
            df = pd.read_excel(xl, sheet_name='Unified_Data')
            # Merge Health_Data to get all disease columns
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
            # Single-sheet file
            df = pd.read_excel(xl, sheet_name=0)

    return df


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Backend is running'}), 200


@app.route('/api/barangays', methods=['POST'])
def get_barangays():
    """Get list of barangays AND available disease columns from uploaded file"""
    filepath = None
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only .xlsx and .xls allowed'}), 400

    try:
        # Save file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Use context manager to ensure file is closed
        with pd.ExcelFile(filepath) as xl:
            sheets = xl.sheet_names

            # Read disease columns from Health_Data sheet
            if 'Health_Data' in sheets:
                df_source = pd.read_excel(xl, sheet_name='Health_Data')
            elif 'Unified_Data' in sheets:
                df_source = pd.read_excel(xl, sheet_name='Unified_Data')
            else:
                df_source = pd.read_excel(xl, sheet_name=0)

        # File is now closed, get data
        barangays = sorted(df_source['barangay'].dropna().unique().tolist())
        disease_columns = detect_disease_columns(df_source)
        
        # Clear references
        del df_source
        gc.collect()

        print(f"✅ Barangays: {len(barangays)} | Diseases detected: {disease_columns}")

        # Clean up the temporary file
        try:
            os.remove(filepath)
        except:
            pass

        return jsonify({
            'barangays': barangays,
            'disease_columns': disease_columns,
        }), 200

    except Exception as e:
        # Clean up on error
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except:
                pass
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast', methods=['POST'])
def forecast():
    """Main forecasting endpoint"""
    filepath = None

    # Validate file
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    # Get parameters
    barangay = request.form.get('barangay')
    target_diseases = request.form.getlist('diseases')
    forecast_months = int(request.form.get('forecast_months', 6))

    if not barangay:
        return jsonify({'error': 'Barangay not specified'}), 400

    try:
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Load and merge all sheets (file closed after this)
        df_merged = load_and_merge_sheets(filepath)

        # Auto-detect diseases if none specified
        if not target_diseases:
            target_diseases = detect_disease_columns(df_merged)

        # Only keep disease columns that exist
        target_diseases = [d for d in target_diseases if d in df_merged.columns]

        if not target_diseases:
            return jsonify({'error': 'No valid disease columns found in the uploaded file.'}), 400

        # Process data
        processor = DataProcessor(sequence_length=app.config['SEQUENCE_LENGTH'])
        df_filtered = processor.load_and_filter_data_from_df(df_merged, barangay)

        # Clear merged data
        del df_merged
        gc.collect()

        # Prepare features
        scaled_data, feature_cols = processor.prepare_features(df_filtered, target_diseases)

        # Get indices of target columns
        target_indices = [feature_cols.index(col) for col in target_diseases]

        # Create sequences
        X, y = processor.create_sequences(scaled_data, target_indices)

        if len(X) < 20:
            return jsonify({'error': 'Not enough historical data for training. Need at least 32 months of data.'}), 400

        # Build and train LSTM model
        forecaster = LSTMForecaster(
            sequence_length=app.config['SEQUENCE_LENGTH'],
            n_features=len(feature_cols),
            n_outputs=len(target_diseases)
        )

        forecaster.build_model()
        print(f"🧠 Training model for {barangay} | diseases: {target_diseases} | features: {len(feature_cols)}")
        forecaster.train(X, y, epochs=app.config['EPOCHS'], batch_size=app.config['BATCH_SIZE'])

        # Make forecast
        last_sequence = scaled_data.values[-app.config['SEQUENCE_LENGTH']:]
        predictions_scaled = forecaster.forecast(last_sequence, n_months=forecast_months)

        # Inverse transform predictions
        predictions_original = processor.inverse_transform_predictions(
            predictions_scaled,
            target_diseases
        )

        # Generate forecast dates
        last_date = df_filtered['date'].max()
        forecast_dates = [
            (last_date + timedelta(days=30 * (i + 1))).strftime('%Y-%m')
            for i in range(forecast_months)
        ]

        # Prepare response
        forecast_data = {
            'barangay': barangay,
            'forecast_dates': forecast_dates,
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

        # Clean up - force garbage collection before removing file
        del df_filtered, scaled_data, X, y, forecaster
        gc.collect()

        # Now try to remove the file
        try:
            os.remove(filepath)
        except PermissionError:
            # If still locked, we'll leave it and clean up later
            print(f"⚠️ Could not delete {filepath} - will be cleaned up later")
            pass

        print(f"✅ Forecast completed for {barangay}")
        return jsonify(forecast_data), 200

    except Exception as e:
        # Clean up on error
        if filepath and os.path.exists(filepath):
            try:
                gc.collect()
                os.remove(filepath)
            except:
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
