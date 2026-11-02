from datetime import datetime, date

from flask_login import UserMixin
from werkzeug.security import (
    generate_password_hash,
    check_password_hash,
)
from flask_login import login_required, current_user
from .extensions import db
from cryptography.fernet import Fernet
import base64
import hashlib

from sqlalchemy.orm import validates


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(
        db.String(80),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    role = db.Column(
        db.String(20),
        nullable=False,
        default="user"
    )

    active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    root_path = db.Column(
        db.String(255),
        nullable=True
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(
            self.password_hash,
            password
        )

    def is_admin(self):
        return self.role == "admin"


    def set_root_path(self, new_path):
        """Actualiza el root_path del usuario"""
        self.root_path = new_path
        db.session.commit()
        return True

    @property
    def is_active(self):
        return self.active





class CalendarTask(db.Model):
    __tablename__ = "calendar_tasks"

    id = db.Column(db.Integer, primary_key=True)
    task = db.Column(db.String(150), nullable=False)
    project = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pendiente")
    
    start_date = db.Column(db.Date, nullable=False, default=datetime.utcnow, index=True)
    end_date = db.Column(db.Date, nullable=False,  default=datetime.utcnow, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    @validates('end_date')
    def validate_end_date(self, key, value):
        if value <= self.start_date:
            raise ValueError("end_date debe ser posterior a start_date")
        return value

    @validates('start_date')
    def validate_start_date(self, key, value):
        if hasattr(self, 'end_date') and self.end_date and value >= self.end_date:
            raise ValueError("start_date debe ser anterior a end_date")
        return value

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.task,
            "start": self.start_date.isoformat(),
            "end": self.end_date.isoformat(),
            "project": self.project,
            "description": self.description or "",
            "status": self.status,
            "created_at": self.created_at.isoformat()
        }


class Note(db.Model):
    __tablename__ = "notes"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey('user.id'),
        nullable=False,
        index=True
    )

    title = db.Column(
        db.String(255),
        nullable=False
    )

    content = db.Column(
        db.Text,
        nullable=False
    )

    is_encrypted = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    password_hash = db.Column(
        db.String(255),
        nullable=True  # Solo para notas cifradas
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow(),  # ← Añade paréntesis
        nullable=False
    )

    # ========== MÉTODOS DE CIFRADO ==========

    @staticmethod
    def _generate_key_from_password(password):
        """Genera una clave de cifrado a partir de una contraseña"""
        password_bytes = password.encode()
        # Usar PBKDF2 para derivar la clave
        key = base64.urlsafe_b64encode(
            hashlib.pbkdf2_hmac('sha256', password_bytes, b'salt', 100000)[:32]
        )
        return key

    def encrypt_content(self, content, password):
        """Cifra el contenido con la contraseña proporcionada"""
        key = self._generate_key_from_password(password)
        cipher = Fernet(key)
        encrypted = cipher.encrypt(content.encode())
        self.content = encrypted.decode()
        self.is_encrypted = True
        self.password_hash = generate_password_hash(password)

    def decrypt_content(self, password):
        """Descifra el contenido si la contraseña es correcta"""
        if not self.is_encrypted:
            return self.content

        # Verificar contraseña
        if not check_password_hash(self.password_hash, password):
            raise ValueError("Contraseña incorrecta")

        try:
            key = self._generate_key_from_password(password)
            cipher = Fernet(key)
            decrypted = cipher.decrypt(self.content.encode())
            return decrypted.decode()
        except Exception as e:
            raise ValueError(f"Error al descifrar: {str(e)}")

    def to_dict(self, decrypted=False, password=None):
        """Convierte la nota a diccionario"""
        content = self.content
        
        if decrypted and self.is_encrypted and password:
            try:
                content = self.decrypt_content(password)
            except ValueError:
                return None

        return {
            "id": self.id,
            "title": self.title,
            "content": content if not self.is_encrypted else "[Cifrada]",
            "is_encrypted": self.is_encrypted,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }