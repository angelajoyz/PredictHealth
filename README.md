# PredictHealth Backend Setup 🏥

## Quick Start Guide

### Step 1: Navigate to backend folder
```bash
cd backend
```

### Step 2: Create virtual environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Run the server
```bash
python app.py
```

Server will start at: **http://localhost:5000**

---

## Testing the API

### Test 1: Health Check
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{"status": "healthy", "message": "Backend is running"}
```

### Test 2: Get Barangays
Use Postman or:
```bash
curl -X POST http://localhost:5000/api/barangays \
  -F "file=@path/to/your/dataset.xlsx"
```

### Test 3: Forecast
```bash
curl -X POST http://localhost:5000/api/forecast \
  -F "file=@path/to/your/dataset.xlsx" \
  -F "barangay=Bolosan" \
  -F "diseases=dengue_cases" \
  -F "diseases=diarrhea_cases" \
  -F "forecast_months=6"
```

---

## Folder Structure
```
backend/
├── app.py                    # Main Flask application
├── config.py                 # Configuration settings
├── requirements.txt          # Python dependencies
├── models/
│   ├── __init__.py
│   ├── data_processor.py     # Data preprocessing
│   └── lstm_model.py         # LSTM model
├── uploads/                  # Temporary file storage
└── trained_models/           # Saved models (optional)
```

---

## Troubleshooting

### Error: Module not found
```bash
pip install -r requirements.txt
```

### Error: Port 5000 already in use
Change port in app.py:
```python
app.run(debug=True, host='0.0.0.0', port=5001)
```

### Error: TensorFlow installation issues
For Windows:
```bash
pip install tensorflow-cpu==2.15.0
```

---

## Next Steps

1. ✅ Backend running on localhost:5000
2. Update React frontend to call these APIs
3. Test with your actual dataset
4. Add charts to display results

Good luck! 🚀
