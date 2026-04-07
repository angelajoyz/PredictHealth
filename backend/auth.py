"""
AUTH ROUTES
===========
Endpoints:
  POST /api/auth/login          → login, returns JWT token
  POST /api/auth/logout         → logout (client deletes token)
  GET  /api/auth/me             → get current user info

Admin-only endpoints:
  GET    /api/admin/users       → list all users
  POST   /api/admin/users       → create new user (no public signup)
  PUT    /api/admin/users/<id>  → update user (reset password, toggle active)
  DELETE /api/admin/users/<id>  → delete user
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)
from datetime import datetime
from backend.database import db, User

auth_bp  = Blueprint('auth',  __name__)
admin_bp = Blueprint('admin', __name__)


# ── Helpers ──────────────────────────────────────────────

def get_current_user():
    uid = get_jwt_identity()
    return User.query.get(int(uid))  # convert back to int para sa DB lookup

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

    # Update last login
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
    # JWT is stateless — client just deletes the token
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

    old_pw  = data.get('old_password', '')
    new_pw  = data.get('new_password', '')

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
    """Admin creates a new staff account. No public signup."""
    data = request.get_json() or {}

    username  = data.get('username', '').strip()
    email     = data.get('email', '').strip()
    password  = data.get('password', '')
    full_name = data.get('full_name', '').strip()
    role      = data.get('role', 'staff')

    # Validation
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
    """Update user info, reset password, or toggle active status."""
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if 'full_name'  in data: user.full_name  = data['full_name'].strip()
    if 'email'      in data: user.email      = data['email'].strip()
    if 'role'       in data:
        if data['role'] not in ('admin', 'staff'):
            return jsonify({'error': 'Role must be admin or staff'}), 400
        user.role = data['role']
    if 'is_active'  in data: user.is_active  = bool(data['is_active'])
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
    from backend.database import UploadHistory
    uploads = UploadHistory.query.order_by(UploadHistory.uploaded_at.desc()).limit(100).all()
    return jsonify([u.to_dict() for u in uploads]), 200


# ── Saved forecasts ──────────────────────────────────────

@admin_bp.route('/forecasts', methods=['GET'])
@admin_required
def list_forecasts():
    from backend.database import Forecast
    forecasts = Forecast.query.order_by(Forecast.created_at.desc()).limit(100).all()
    return jsonify([f.to_dict() for f in forecasts]), 200