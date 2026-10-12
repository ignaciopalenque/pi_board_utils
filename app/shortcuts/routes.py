from flask import (
    Blueprint,
    jsonify,
    render_template,
)

from flask_login import current_user, login_required

from .executor import (
    execute_shortcut,
    find_shortcut,
    load_shortcuts,
)


shortcuts_bp = Blueprint(
    "shortcuts",
    __name__,
    url_prefix="/shortcuts"
)


@shortcuts_bp.route("/")
@login_required
def index():
    shortcuts = []

    for shortcut in load_shortcuts():
        required_role = shortcut.get("role", "user")

        if required_role == "admin" and not current_user.is_admin():
            continue

        shortcuts.append(shortcut)

    return render_template(
        "section.html",
        title="Accesos directos",
        description="Acciones configuradas en shortcuts.json",
        shortcuts=shortcuts,
    )


@shortcuts_bp.route("/<shortcut_id>/execute", methods=["POST"])
@login_required
def execute(shortcut_id):
    shortcut = find_shortcut(shortcut_id)

    if shortcut is None:
        return jsonify({
            "success": False,
            "error": "Acceso directo no encontrado",
        }), 404

    required_role = shortcut.get("role", "user")

    if required_role == "admin" and not current_user.is_admin():
        return jsonify({
            "success": False,
            "error": "No tienes permisos para esta acción",
        }), 403

    try:
        result = execute_shortcut(shortcut)
        return jsonify(result)

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error),
        }), 500
