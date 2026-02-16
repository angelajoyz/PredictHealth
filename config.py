import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    UPLOAD_FOLDER = 'uploads'
    MODEL_FOLDER = 'trained_models'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'xlsx', 'xls'}
    
    # LSTM Parameters
    SEQUENCE_LENGTH = 6   # ✅ was 12 — 6 is better for ~84 rows per barangay
    FORECAST_MONTHS = 6
    EPOCHS = 100          # ✅ was 50 — more epochs = better learning on small data
    BATCH_SIZE = 16       # ✅ was 32 — smaller batch = better for small data