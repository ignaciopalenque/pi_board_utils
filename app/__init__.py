from pathlib import Path

from flask import Flask
from flask import request, jsonify
from .config import Config
from .extensions import db, login_manager, csrf
from .models import User




def create_app():
    app = Flask(__name__)

    print(">>> APLICACIÓN FLASK INICIADA CON ESTE CÓDIGO", flush=True)

    @app.before_request
    def debug_todas_las_peticion():
        print(
            f">>> GLOBAL: {request.method} {request.path}",
            flush=True
        )
    app.config.from_object(Config)
    app.config['MAX_CONTENT_LENGTH'] = None

    Path(app.instance_path).mkdir(
        parents=True,
        exist_ok=True
    )

    @app.errorhandler(400)
    def debug_error_400(error):
        print("\n>>> SE HA GENERADO UN ERROR 400", flush=True)
        print("Ruta:", request.path, flush=True)
        print("Descripción:", str(error), flush=True)
        print("Tipo:", type(error).__name__, flush=True)

        original = getattr(error, "description", None)
        print("Detalle:", original, flush=True)

        return jsonify({
            "error": "Error 400",
            "detalle": str(original or error),
            "ruta": request.path
        }), 400

    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)

    from .auth.routes import auth_bp
    from .dashboard.routes import dashboard_bp
    from .clipboard.routes import clipboard_bp
    from .shortcuts.routes import shortcuts_bp
    from app.files.routes import files_bp  # NUEVO
    from app.calendar.routes import calendar_bp
    from app.intranet.routes import intranet_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(clipboard_bp)
    app.register_blueprint(shortcuts_bp)
    app.register_blueprint(files_bp)  # NUEVO
    app.register_blueprint(calendar_bp)  # NUEVO
    app.register_blueprint(intranet_bp)  # NUEVO

    register_placeholder_routes(app)


    @app.before_request
    def debug_all_requests():
        if request.path == '/api/files/set-root':
            print("\n========== SET-ROOT ==========", flush=True)
            print("Método:", request.method, flush=True)
            print("Ruta:", request.path, flush=True)
            print("Content-Type:", request.content_type, flush=True)
            print("is_json:", request.is_json, flush=True)
            print("Datos sin procesar:", request.get_data(as_text=True), flush=True)
            print("================================", flush=True)

    with app.app_context():
        db.create_all()
        create_default_user()

    return app


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def create_default_user():
    if User.query.first() is not None:
        return

    user = User(
        username="admin",
        role="admin",
        active=True
    )

    user.set_password("cambia-esta-contraseña")

    db.session.add(user)
    db.session.commit()

    print("Usuario inicial creado: admin")
    print("Cambia la contraseña inmediatamente.")


def change_password(password):

    user = User(
        username="admin",
        role="admin",
        active=True
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()


def register_placeholder_routes(app):
    from flask import render_template
    from flask_login import login_required

    @app.route("/documentos")
    @login_required
    def documentos():
        return render_template(
            "section.html",
            title="Documentos",
            description="Repositorio documental."
        )

    @app.route("/calendario")
    @login_required
    def calendario():
        return render_template(
            "section.html",
            title="Calendario y tareas",
            description="Calendario y gestión de tareas."
        )

    @app.route("/notas")
    @login_required
    def notas():
        return render_template(
            "section.html",
            title="Notas",
            description="Notas personales y compartidas."
        )

    @app.route("/portapapeles")
    @login_required
    def portapapeles():
        return render_template(
            "section.html",
            title="Portapapeles",
            description="Portapapeles interno."
        )
