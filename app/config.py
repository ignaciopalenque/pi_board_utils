import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SECRET_KEY = os.environ.get(
        "SECRET_KEY",
        "cambia-esta-clave-en-produccion"
    )

    SQLALCHEMY_DATABASE_URI = (
        "sqlite:///" + str(BASE_DIR / "instance" / "app.db")
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAX_CONTENT_LENGTH = 100 * 1024 * 1024

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
