from flask import Flask, request, jsonify,Blueprint, current_app
from pathlib import Path
from datetime import datetime, timezone
import json

clipboard_bp = Blueprint("clipboard", __name__)
def get_clipboard_file():
    # Guarda los datos en la carpeta instance de Flask, fuera de static/
    archivo = Path(current_app.instance_path) / "clipboard" / "store" / "clipboard.json"
    archivo.parent.mkdir(parents=True, exist_ok=True)
    return archivo

@clipboard_bp.route("/api/clipboard", methods=["PUT", "GET"])
def clipboard():
    CLIPBOARD_FILE = get_clipboard_file()
    if request.method == "PUT":
        data = request.get_json(silent=True)

        if not isinstance(data, dict) or not isinstance(data.get("text"), str):
            return jsonify(error="Se esperaba un campo 'text' de tipo texto"), 400

        contenido = {
            "text": data["text"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        CLIPBOARD_FILE.write_text(
            json.dumps(contenido, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        return jsonify(contenido)

    # GET: carga el archivo, o devuelve valores vacíos si aún no existe
    if not CLIPBOARD_FILE.exists():
        return jsonify(text="", updated_at=None)

    try:
        contenido = json.loads(CLIPBOARD_FILE.read_text(encoding="utf-8"))
        return jsonify(contenido)
    except (json.JSONDecodeError, OSError):
        return jsonify(error="No se pudo leer el archivo de portapapeles"), 500