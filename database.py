"""
DATABASE MODELS
===============
Tables:
  - users          → accounts
  - upload_history → tracks every file upload
  - forecasts      → saved forecast results
  - barangay_data  → processed health records (flat columns, age/sex breakdown)
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
# BARANGAY DATA
# ─────────────────────────────────────────────
class BarangayData(db.Model):
    """
    One row = one disease category for a barangay in a given month.

    Age/sex columns store the breakdown exactly as it appears in the source file.
    All age/sex columns are nullable — if file has no breakdown, they are NULL
    and only the _total columns are filled.

    Disease category columns (_cases) store aggregated totals
    for that category in that row's barangay+year+month.
    """
    __tablename__ = 'barangay_data'

    id        = db.Column(db.Integer, primary_key=True)
    upload_id = db.Column(db.Integer, db.ForeignKey('upload_history.id'), nullable=False)

    # ── Location ──────────────────────────────────────────
    city     = db.Column(db.String(100), nullable=True)
    barangay = db.Column(db.String(150), nullable=False)

    # ── Time ──────────────────────────────────────────────
    year  = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    week  = db.Column(db.Integer, nullable=True)   # NULL if monthly

    # ── Disease category (for LSTM forecast) ─────────────
    disease_category = db.Column(db.String(50),  nullable=False)  # e.g. 'respiratory'
    disease_label = db.Column(db.String(500), nullable=True)   # e.g. 'Respiratory'

    # ── Totals (always filled) ────────────────────────────
    total_male   = db.Column(db.Integer, nullable=False, default=0)
    total_female = db.Column(db.Integer, nullable=False, default=0)
    total_cases  = db.Column(db.Integer, nullable=False, default=0)

    # ── Age/sex breakdown (nullable) ──────────────────────
    under1_m        = db.Column(db.Integer, nullable=True)
    under1_f        = db.Column(db.Integer, nullable=True)
    age_1_4_m       = db.Column(db.Integer, nullable=True)
    age_1_4_f       = db.Column(db.Integer, nullable=True)
    age_5_9_m       = db.Column(db.Integer, nullable=True)
    age_5_9_f       = db.Column(db.Integer, nullable=True)
    age_10_14_m     = db.Column(db.Integer, nullable=True)
    age_10_14_f     = db.Column(db.Integer, nullable=True)
    age_15_19_m     = db.Column(db.Integer, nullable=True)
    age_15_19_f     = db.Column(db.Integer, nullable=True)
    age_20_24_m     = db.Column(db.Integer, nullable=True)
    age_20_24_f     = db.Column(db.Integer, nullable=True)
    age_25_29_m     = db.Column(db.Integer, nullable=True)
    age_25_29_f     = db.Column(db.Integer, nullable=True)
    age_30_34_m     = db.Column(db.Integer, nullable=True)
    age_30_34_f     = db.Column(db.Integer, nullable=True)
    age_35_39_m     = db.Column(db.Integer, nullable=True)
    age_35_39_f     = db.Column(db.Integer, nullable=True)
    age_40_44_m     = db.Column(db.Integer, nullable=True)
    age_40_44_f     = db.Column(db.Integer, nullable=True)
    age_45_49_m     = db.Column(db.Integer, nullable=True)
    age_45_49_f     = db.Column(db.Integer, nullable=True)
    age_50_54_m     = db.Column(db.Integer, nullable=True)
    age_50_54_f     = db.Column(db.Integer, nullable=True)
    age_55_59_m     = db.Column(db.Integer, nullable=True)
    age_55_59_f     = db.Column(db.Integer, nullable=True)
    age_60_64_m     = db.Column(db.Integer, nullable=True)
    age_60_64_f     = db.Column(db.Integer, nullable=True)
    age_65above_m   = db.Column(db.Integer, nullable=True)
    age_65above_f   = db.Column(db.Integer, nullable=True)
    age_65_69_m     = db.Column(db.Integer, nullable=True)
    age_65_69_f     = db.Column(db.Integer, nullable=True)
    age_70above_m   = db.Column(db.Integer, nullable=True)
    age_70above_f   = db.Column(db.Integer, nullable=True)
    days_0_6_m      = db.Column(db.Integer, nullable=True)
    days_0_6_f      = db.Column(db.Integer, nullable=True)
    days_7_28_m     = db.Column(db.Integer, nullable=True)
    days_7_28_f     = db.Column(db.Integer, nullable=True)
    days_29_11mo_m  = db.Column(db.Integer, nullable=True)
    days_29_11mo_f  = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_bd_lookup',   'city', 'barangay', 'year', 'month', 'disease_category'),
        db.Index('ix_bd_category', 'disease_category', 'year', 'month'),
    )

    # Mapping: source file column name → model attribute
    AGE_SEX_COL_MAP = {
        'UNDER1_M':       'under1_m',
        'UNDER1_F':       'under1_f',
        '1_4_M':          'age_1_4_m',
        '1_4_F':          'age_1_4_f',
        '5_9_M':          'age_5_9_m',
        '5_9_F':          'age_5_9_f',
        '10_14_M':        'age_10_14_m',
        '10_14_F':        'age_10_14_f',
        '15_19_M':        'age_15_19_m',
        '15_19_F':        'age_15_19_f',
        '20_24_M':        'age_20_24_m',
        '20_24_F':        'age_20_24_f',
        '25_29_M':        'age_25_29_m',
        '25_29_F':        'age_25_29_f',
        '30_34_M':        'age_30_34_m',
        '30_34_F':        'age_30_34_f',
        '35_39_M':        'age_35_39_m',
        '35_39_F':        'age_35_39_f',
        '40_44_M':        'age_40_44_m',
        '40_44_F':        'age_40_44_f',
        '45_49_M':        'age_45_49_m',
        '45_49_F':        'age_45_49_f',
        '50_54_M':        'age_50_54_m',
        '50_54_F':        'age_50_54_f',
        '55_59_M':        'age_55_59_m',
        '55_59_F':        'age_55_59_f',
        '60_64_M':        'age_60_64_m',
        '60_64_F':        'age_60_64_f',
        '65ABOVE_M':      'age_65above_m',
        '65ABOVE_F':      'age_65above_f',
        '65_69_M':        'age_65_69_m',
        '65_69_F':        'age_65_69_f',
        '70ABOVE_M':      'age_70above_m',
        '70ABOVE_F':      'age_70above_f',
        '0_6DAYS_M':      'days_0_6_m',
        '0_6DAYS_F':      'days_0_6_f',
        '7_28DAYS_M':     'days_7_28_m',
        '7_28DAYS_F':     'days_7_28_f',
        '29DAYS_11MOS_M': 'days_29_11mo_m',
        '29DAYS_11MOS_F': 'days_29_11mo_f',
    }

    def to_dict(self):
        d = {
            'id':               self.id,
            'city':             self.city,
            'barangay':         self.barangay,
            'year':             self.year,
            'month':            self.month,
            'disease_category': self.disease_category,
            'disease_label':    self.disease_label,
            'total_male':       self.total_male,
            'total_female':     self.total_female,
            'total_cases':      self.total_cases,
        }
        for src, attr in self.AGE_SEX_COL_MAP.items():
            d[src] = getattr(self, attr)
        return d


# ─────────────────────────────────────────────
# HELPER: aggregate for LSTM forecast
# ─────────────────────────────────────────────
def get_aggregated_data(city=None, barangay=None):
    """
    Query barangay_data and pivot to wide format for LSTM.
    Returns list of dicts: [{barangay, city, year, month, respiratory_cases, ...}]
    """
    from sqlalchemy import func
    from collections import defaultdict

    q = db.session.query(
        BarangayData.city,
        BarangayData.barangay,
        BarangayData.year,
        BarangayData.month,
        BarangayData.disease_category,
        func.sum(BarangayData.total_cases).label('total'),
    )

    if city:
        q = q.filter(BarangayData.city == city)
    if barangay and barangay != '__ALL__':
        q = q.filter(BarangayData.barangay.ilike(barangay))

    q = q.group_by(
        BarangayData.city,
        BarangayData.barangay,
        BarangayData.year,
        BarangayData.month,
        BarangayData.disease_category,
    ).order_by(BarangayData.barangay, BarangayData.year, BarangayData.month)

    rows = q.all()
    if not rows:
        return []

    # Pivot: one row per (barangay, year, month) with disease_category columns
    pivot = defaultdict(lambda: {'city': '', 'barangay': '', 'year': 0, 'month': 0})
    for r in rows:
        key = (r.barangay, r.year, r.month)
        pivot[key]['city']     = r.city or ''
        pivot[key]['barangay'] = r.barangay
        pivot[key]['year']     = r.year
        pivot[key]['month']    = r.month
        col = f"{r.disease_category}_cases"
        pivot[key][col] = int(r.total or 0)

    return list(pivot.values())


# ─────────────────────────────────────────────
# INIT
# ─────────────────────────────────────────────
def init_db(app):
    with app.app_context():
        try:
            BarangayData.__table__.drop(db.engine, checkfirst=True)
            print("   Old barangay_data table dropped.")
        except Exception as e:
            print(f"   Could not drop barangay_data: {e}")

        db.create_all()
        print("   All tables created.")

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
            print("   Default admin created — username: admin | password: Admin@2024!")