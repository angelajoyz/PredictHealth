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
        "postgresql://postgres:meiosei@localhost:5432/predicthealth"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Email (Gmail SMTP)
    MAIL_SERVER   = 'smtp.gmail.com'
    MAIL_PORT     = 587
    MAIL_USE_TLS  = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') or 'predicthealth.noreply@gmail.com'
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') or 'gjji dbxd ypjm wvql'  # Gmail App Password
    MAIL_DEFAULT_SENDER = ('PredictHealth', MAIL_USERNAME)