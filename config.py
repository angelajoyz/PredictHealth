import os
from datetime import timedelta

class Config:
    SECRET_KEY     = os.environ.get('SECRET_KEY')     or 'dev-secret-key-change-in-production'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key-change-in-production'

    UPLOAD_FOLDER       = 'uploads'
    MODEL_FOLDER        = 'trained_models'
    MAX_CONTENT_LENGTH  = 16 * 1024 * 1024   # 16 MB
    ALLOWED_EXTENSIONS  = {'xlsx', 'xls', 'csv'}

    # JWT token expiry — 8 hours
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # LSTM Parameters
    SEQUENCE_LENGTH = 6
    FORECAST_MONTHS = 6
    EPOCHS          = 100
    BATCH_SIZE      = 16

    # Database
    SQLALCHEMY_DATABASE_URI = (
        os.environ.get('DATABASE_URL') or
        "postgresql://postgres:johnfrancis2003@localhost:5432/predicthealth"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False