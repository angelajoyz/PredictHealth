"""
DATABASE MODELS
===============
Tables:
  - users          → accounts
  - upload_history → tracks every file upload
  - forecasts      → saved forecast results
  - barangay_data  → monthly health data (wide format, dynamic disease columns)

barangay_data structure:
  city | barangay | year | month | diseases (JSON) | dominant_sex | dominant_age_group

  diseases JSON stores only the diseases present in the file:
  {"hfmd_cases": 3, "measles_cases": 2, "influenza_cases": 1}

  dominant_sex      → most common sex per barangay/month (M/F/NULL if not in file)
  dominant_age_group→ most common age group per barangay/month (NULL if not in file)
"""

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()


# ─────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────
class User(db.Model):
    __tablename__ = 'users'

    id         = db.Column(db.Integer,     primary_key=True)
    username   = db.Column(db.String(80),  unique=True, nullable=False)
    email      = db.Column(db.String(120), unique=True, nullable=False)
    password   = db.Column(db.String(256), nullable=False)
    full_name  = db.Column(db.String(150), nullable=True)
    role       = db.Column(db.String(20),  default='staff')
    is_active  = db.Column(db.Boolean,     default=True)
    created_at = db.Column(db.DateTime,    default=datetime.utcnow)
    last_login = db.Column(db.DateTime,    nullable=True)

    uploads   = db.relationship('UploadHistory', backref='user', lazy=True)
    forecasts = db.relationship('Forecast',      backref='user', lazy=True)

    def set_password(self, raw):
        self.password = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password, raw)

    def to_dict(self):
        return {
            'id':         self.id,
            'username':   self.username,
            'email':      self.email,
            'full_name':  self.full_name,
            'role':       self.role,
            'is_active':  self.is_active,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }


# ─────────────────────────────────────────────
# UPLOAD HISTORY
# ─────────────────────────────────────────────
class UploadHistory(db.Model):
    __tablename__ = 'upload_history'

    id               = db.Column(db.Integer,     primary_key=True)
    user_id          = db.Column(db.Integer,     db.ForeignKey('users.id'), nullable=False)
    filename         = db.Column(db.String(255), nullable=False)
    city             = db.Column(db.String(100), nullable=True)
    barangay_count   = db.Column(db.Integer,     nullable=True)
    disease_count    = db.Column(db.Integer,     nullable=True)
    date_range_start = db.Column(db.String(20),  nullable=True)
    date_range_end   = db.Column(db.String(20),  nullable=True)
    uploaded_at      = db.Column(db.DateTime,    default=datetime.utcnow)
    status           = db.Column(db.String(20),  default='success')
    error_msg        = db.Column(db.Text,        nullable=True)

    barangay_records = db.relationship('BarangayData', backref='upload', lazy=True)

    def to_dict(self):
        return {
            'id':               self.id,
            'username':         self.user.username if self.user else None,
            'filename':         self.filename,
            'city':             self.city,
            'barangay_count':   self.barangay_count,
            'disease_count':    self.disease_count,
            'date_range_start': self.date_range_start,
            'date_range_end':   self.date_range_end,
            'uploaded_at':      self.uploaded_at.isoformat(),
            'status':           self.status,
            'error_msg':        self.error_msg,
        }


# ─────────────────────────────────────────────
# FORECASTS
# ─────────────────────────────────────────────
class Forecast(db.Model):
    __tablename__ = 'forecasts'

    id              = db.Column(db.Integer,     primary_key=True)
    user_id         = db.Column(db.Integer,     db.ForeignKey('users.id'), nullable=False)
    city            = db.Column(db.String(100), nullable=True)
    barangay        = db.Column(db.String(150), nullable=False)
    diseases        = db.Column(db.JSON,        nullable=False)
    forecast_months = db.Column(db.Integer,     nullable=False)
    forecast_dates  = db.Column(db.JSON,        nullable=False)
    predictions     = db.Column(db.JSON,        nullable=False)
    historical_data = db.Column(db.JSON,        nullable=True)
    created_at      = db.Column(db.DateTime,    default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':              self.id,
            'username':        self.user.username if self.user else None,
            'city':            self.city,
            'barangay':        self.barangay,
            'diseases':        self.diseases,
            'forecast_months': self.forecast_months,
            'forecast_dates':  self.forecast_dates,
            'predictions':     self.predictions,
            'historical_data': self.historical_data,
            'created_at':      self.created_at.isoformat(),
        }


# ─────────────────────────────────────────────
# BARANGAY DATA — monthly wide format
# ─────────────────────────────────────────────
class BarangayData(db.Model):
    """
    One row = one barangay, one month.

    diseases JSON = only the diseases present in the uploaded file:
      {"hfmd_cases": 3, "measles_cases": 2}
      Never stores 0 for diseases not in the file.

    dominant_sex       = most common sex that month for that barangay (M/F)
                         NULL if file has no sex column
    dominant_age_group = most common age group that month for that barangay
                         e.g. "Child (1-4)", "Adult (18-59)", "Senior (60+)"
                         NULL if file has no age column
    """
    __tablename__ = 'barangay_data'

    id        = db.Column(db.Integer,     primary_key=True)
    upload_id = db.Column(db.Integer,     db.ForeignKey('upload_history.id'), nullable=False)

    # ── Location ───────────────────────────────────────────
    city     = db.Column(db.String(100), nullable=True)
    barangay = db.Column(db.String(150), nullable=False)

    # ── Time ───────────────────────────────────────────────
    year  = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)

    # ── Disease counts (dynamic — only what's in the file) ─
    diseases = db.Column(db.JSON, nullable=False, default=dict)
    # Example: {"hfmd_cases": 3, "measles_cases": 2, "influenza_cases": 1}

    # ── Demographics (NULL if not in file) ─────────────────
    dominant_sex       = db.Column(db.String(10),  nullable=True)
    # Most common sex per barangay+month: 'M', 'F', or NULL

    dominant_age_group = db.Column(db.String(50),  nullable=True)
    # Most common age group: 'Infant (0-1)', 'Child (1-4)', 'Child (5-9)',
    # 'Teen (10-17)', 'Adult (18-59)', 'Senior (60+)', or NULL

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_barangay_data_lookup', 'city', 'barangay', 'year', 'month'),
        db.Index('ix_barangay_data_year',   'year', 'month'),
    )

    def to_dict(self):
        return {
            'id':                self.id,
            'city':              self.city,
            'barangay':          self.barangay,
            'year':              self.year,
            'month':             self.month,
            'dominant_sex':      self.dominant_sex,
            'dominant_age_group':self.dominant_age_group,
            **(self.diseases or {}),
        }


# ─────────────────────────────────────────────
# AGE GROUP CLASSIFIER
# ─────────────────────────────────────────────
def classify_age(age):
    """Convert numeric age → age group label."""
    try:
        age = float(age)
    except (TypeError, ValueError):
        return 'Unknown'
    if age < 1:    return 'Infant (0-1)'
    if age <= 4:   return 'Child (1-4)'
    if age <= 9:   return 'Child (5-9)'
    if age <= 17:  return 'Teen (10-17)'
    if age <= 59:  return 'Adult (18-59)'
    return 'Senior (60+)'


# ─────────────────────────────────────────────
# HELPER — get data for LSTM forecast
# ─────────────────────────────────────────────
def get_aggregated_data(city=None, barangay=None):
    """
    Query barangay_data and return list of dicts ready for DataFrame.
    Each dict = one barangay+month with disease columns expanded flat.

    Example output row:
    {
      'city': 'Boac', 'barangay': 'CAWIT', 'year': 2014, 'month': 1,
      'hfmd_cases': 3, 'measles_cases': 2,
      'dominant_sex': 'F', 'dominant_age_group': 'Child (1-4)'
    }
    """
    q = BarangayData.query

    if city:
        q = q.filter(BarangayData.city == city)
    if barangay and barangay != '__ALL__':
        q = q.filter(BarangayData.barangay.ilike(barangay))

    rows = q.order_by(
        BarangayData.barangay,
        BarangayData.year,
        BarangayData.month,
    ).all()

    if not rows:
        return []

    result = []
    for r in rows:
        record = {
            'city':               r.city or '',
            'barangay':           r.barangay,
            'year':               r.year,
            'month':              r.month,
            'dominant_sex':       r.dominant_sex,
            'dominant_age_group': r.dominant_age_group,
        }
        # Expand diseases JSON → flat columns
        if r.diseases:
            record.update(r.diseases)
        result.append(record)

    return result


# ─────────────────────────────────────────────
# INIT
# ─────────────────────────────────────────────
def init_db(app):
    with app.app_context():
        db.create_all()
        print("✅ All tables created/verified.")

        if User.query.count() == 0:
            admin = User(
                username  = 'admin',
                email     = 'admin@cityhealth.gov.ph',
                full_name = 'System Administrator',
                role      = 'admin',
                is_active = True,
            )
            admin.set_password('Admin@2024!')
            db.session.add(admin)
            db.session.commit()
            print("✅ Default admin → username: admin | password: Admin@2024!")