from datetime import datetime, date

from flask_login import UserMixin
from werkzeug.security import (
    generate_password_hash,
    check_password_hash,
)

from .extensions import db


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

    task = db.Column(
        db.String(150),
        nullable=False
    )

    project = db.Column(
        db.String(150),
        nullable=False
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="pendiente"
    )

    task_date = db.Column(
        db.Date,
        nullable=False,
        default=date.today,
        index=True
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    def to_dict(self):
        return {
            "id": self.id,
            "task": self.task,
            "project": self.project,
            "description": self.description or "",
            "status": self.status,
            "task_date": self.task_date.isoformat(),
            "created_at": self.created_at.isoformat()
        }
