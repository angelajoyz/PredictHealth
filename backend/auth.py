"""
AUTH ROUTES
===========
Endpoints:
  POST /api/auth/login                → login, returns JWT token
  POST /api/auth/logout               → logout (client deletes token)
  GET  /api/auth/me                   → get current user info
  POST /api/auth/forgot-password      → send password reset email
  POST /api/auth/reset-password       → set new password via token

Admin-only endpoints:
  GET    /api/admin/users       → list all users
  POST   /api/admin/users       → create new user (no public signup)
  PUT    /api/admin/users/<id>  → update user (reset password, toggle active)
  DELETE /api/admin/users/<id>  → delete user
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)
from flask_mail import Message
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from datetime import datetime
from database import db, User

auth_bp  = Blueprint('auth',  __name__)
admin_bp = Blueprint('admin', __name__)


# ── Helpers ──────────────────────────────────────────────

def get_current_user():
    uid = get_jwt_identity()
    return User.query.get(int(uid))

def admin_required(fn):
    """Decorator: only allow admin role."""
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper

def _get_serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

def _send_verification_email(user):
    """Generate a token and send a verification email."""
    s = _get_serializer()
    token = s.dumps(user.email, salt='email-verify')

    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    verify_link  = f"{frontend_url}/verify-email?token={token}"

    mail = current_app.extensions['mail']
    msg  = Message(
        subject    = 'PredictHealth – Verify your email',
        recipients = [user.email],
        html       = f"""
        <h2>Welcome to PredictHealth!</h2>
        <p>Hi {user.full_name or user.username},</p>
        <p>Please verify your email by clicking the link below:</p>
        <p><a href="{verify_link}">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't register, you can ignore this email.</p>
        """
    )
    mail.send(msg)


def _send_reset_email(user):
    """Generate a password-reset token and send the reset email."""
    s     = _get_serializer()
    token = s.dumps(user.email, salt='password-reset')

    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    reset_link   = f"{frontend_url}/reset-password?token={token}"

    mail = current_app.extensions['mail']
    msg  = Message(
        subject    = 'PredictHealth – Password Reset Request',
        recipients = [user.email],
        html       = f"""
        <h2>Password Reset</h2>
        <p>Hi {user.full_name or user.username},</p>
        <p>We received a request to reset your PredictHealth password.
           Click the button below to choose a new password:</p>
        <p>
          <a href="{reset_link}"
             style="display:inline-block;padding:10px 20px;background:#1B4F8A;
                    color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
            Reset Password
          </a>
        </p>
        <p>This link expires in <strong>30 minutes</strong>.</p>
        <p>If you did not request a password reset, you can safely ignore this email —
           your password will not change.</p>
        <hr/>
        <p style="font-size:12px;color:#6B7280;">
          PredictHealth · Barangay Health Forecasting System
        </p>
        """
    )
    mail.send(msg)


# ── Public registration ──────────────────────────────────

@auth_bp.route('/register', methods=['POST'])
def register():
    return jsonify({'error': 'Public registration is disabled. Contact your administrator.'}), 403



@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    data  = request.get_json() or {}
    token = data.get('token', '')

    if not token:
        return jsonify({'error': 'Token is required'}), 400

    s = _get_serializer()
    try:
        email = s.loads(token, salt='email-verify', max_age=86400)  # 24 hours
    except SignatureExpired:
        return jsonify({'error': 'Verification link has expired. Please request a new one.'}), 400
    except BadSignature:
        return jsonify({'error': 'Invalid verification link.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.email_verified:
        return jsonify({'message': 'Email is already verified'}), 200

    user.email_verified = True
    db.session.commit()

    return jsonify({'message': 'Email verified successfully! You can now log in.'}), 200


@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    data  = request.get_json() or {}
    email = data.get('email', '').strip()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'If that email exists, a verification link has been sent.'}), 200

    if user.email_verified:
        return jsonify({'message': 'Email is already verified'}), 200

    try:
        _send_verification_email(user)
    except Exception as e:
        current_app.logger.error(f"Failed to resend verification email: {e}")
        return jsonify({'error': 'Failed to send email. Try again later.'}), 500

    return jsonify({'message': 'If that email exists, a verification link has been sent.'}), 200


# ── Forgot / Reset password ──────────────────────────────

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """
    Accepts { email }.
    Always returns 200 regardless of whether the email exists —
    this prevents email enumeration attacks.
    Sends a 30-minute reset link if the account is found.
    """
    data  = request.get_json() or {}
    email = data.get('email', '').strip()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Look up user — but don't reveal whether the account exists
    user = User.query.filter_by(email=email).first()

    if user and user.is_active:
        try:
            _send_reset_email(user)
        except Exception as e:
            current_app.logger.error(f"Failed to send reset email to {email}: {e}")
            # Still return 200 — don't leak internal errors to the client

    return jsonify({
        'message': 'If that email is registered, a reset link has been sent.'
    }), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Accepts { token, new_password }.
    Verifies the token (signed email, 30-min TTL), then updates the password.
    """
    data         = request.get_json() or {}
    token        = data.get('token', '').strip()
    new_password = data.get('new_password', '')

    if not token:
        return jsonify({'error': 'Reset token is required'}), 400

    if not new_password:
        return jsonify({'error': 'New password is required'}), 400

    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    s = _get_serializer()
    try:
        # Token TTL: 30 minutes (1800 seconds)
        email = s.loads(token, salt='password-reset', max_age=1800)
    except SignatureExpired:
        return jsonify({
            'error': 'Reset link has expired. Please request a new one.'
        }), 400
    except BadSignature:
        return jsonify({
            'error': 'Invalid or tampered reset link.'
        }), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not user.is_active:
        return jsonify({'error': 'Account is disabled. Contact your administrator.'}), 403

    user.set_password(new_password)
    db.session.commit()

    current_app.logger.info(f"Password reset successful for {email}")
    return jsonify({'message': 'Password reset successfully. You can now log in.'}), 200


# ── Auth routes ──────────────────────────────────────────

@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is disabled. Contact your administrator.'}), 403

    if not user.email_verified:
        return jsonify({'error': 'Please verify your email before logging in.'}), 403

    user.last_login = datetime.utcnow()
    db.session.commit()

    token = create_access_token(identity=str(user.id))

    return jsonify({
        'token': token,
        'user':  user.to_dict(),
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'message': 'Logged out successfully'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user = get_current_user()
    data = request.get_json() or {}

    old_pw = data.get('old_password', '')
    new_pw = data.get('new_password', '')

    if not user.check_password(old_pw):
        return jsonify({'error': 'Current password is incorrect'}), 400

    if len(new_pw) < 8:
        return jsonify({'error': 'New password must be at least 8 characters'}), 400

    user.set_password(new_pw)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'}), 200


# ── Admin routes ─────────────────────────────────────────

@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users]), 200


@admin_bp.route('/users', methods=['POST'])
@admin_required
def create_user():
    data = request.get_json() or {}

    username  = data.get('username', '').strip()
    email     = data.get('email', '').strip()
    password  = data.get('password', '')
    full_name = data.get('full_name', '').strip()
    role      = data.get('role', 'staff')

    if not username or not email or not password:
        return jsonify({'error': 'username, email, and password are required'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    if role not in ('admin', 'staff'):
        return jsonify({'error': 'Role must be admin or staff'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': f"Username '{username}' is already taken"}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({'error': f"Email '{email}' is already registered"}), 409

    user = User(
        username  = username,
        email     = email,
        full_name = full_name,
        role      = role,
        is_active = True,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': f"User '{username}' created successfully",
        'user':    user.to_dict(),
    }), 201


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if 'full_name'  in data: user.full_name = data['full_name'].strip()
    if 'email'      in data: user.email     = data['email'].strip()
    if 'role'       in data:
        if data['role'] not in ('admin', 'staff'):
            return jsonify({'error': 'Role must be admin or staff'}), 400
        user.role = data['role']
    if 'is_active'    in data: user.is_active = bool(data['is_active'])
    if 'new_password' in data:
        if len(data['new_password']) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        user.set_password(data['new_password'])

    db.session.commit()
    return jsonify({
        'message': f"User '{user.username}' updated",
        'user':    user.to_dict(),
    }), 200


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    current = get_current_user()
    if current.id == user_id:
        return jsonify({'error': 'You cannot delete your own account'}), 400

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': f"User '{user.username}' deleted"}), 200


# ── Upload history (admin view) ──────────────────────────

@admin_bp.route('/uploads', methods=['GET'])
@admin_required
def list_uploads():
    from database import UploadHistory
    uploads = UploadHistory.query.order_by(UploadHistory.uploaded_at.desc()).limit(100).all()
    return jsonify([u.to_dict() for u in uploads]), 200


# ── Saved forecasts ──────────────────────────────────────

@admin_bp.route('/forecasts', methods=['GET'])
@admin_required
def list_forecasts():
    from database import Forecast
    forecasts = Forecast.query.order_by(Forecast.created_at.desc()).limit(100).all()
    return jsonify([f.to_dict() for f in forecasts]), 200