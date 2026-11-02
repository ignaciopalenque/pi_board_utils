from flask import Flask, request, jsonify,Blueprint, current_app, render_template 
from flask_login import login_required, current_user
from pathlib import Path
from datetime import datetime, timezone
import json
from app.models import Note
from app.extensions import db


clipboard_bp = Blueprint("clipboard", __name__, url_prefix='/api/clipboard')
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


# ========== NOTAS SIN CIFRAR ==========

@clipboard_bp.route('/notes', methods=['GET'])
@login_required
def get_notes():
    """Obtiene todas las notas del usuario (sin cifradas)"""
    try:
        notes = Note.query.filter_by(
            user_id=current_user.id,
            is_encrypted=False
        ).order_by(Note.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'notes': [note.to_dict() for note in notes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@clipboard_bp.route('/notes/filter')
@login_required
def viewNotesFilter():
    """Vista del explorador de archivos"""
    return render_template('notes.html')


@clipboard_bp.route('/notes/filter/pass')
@login_required
def viewNotesFilterPass():
    """Vista del explorador de archivos"""
    return render_template('notesPass.html')



@clipboard_bp.route('/notes', methods=['POST'])
@login_required
def create_note():
    """Crea una nueva nota sin cifrar"""
    try:
        data = request.get_json()
        
        if not data.get('title') or not data.get('content'):
            return jsonify({'error': 'Título y contenido son requeridos'}), 400
        
        note = Note(
            user_id=current_user.id,
            title=data['title'],
            content=data['content'],
            is_encrypted=False
        )
        
        db.session.add(note)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'note': note.to_dict()
        }), 201
    except Exception as e:
            db.session.rollback()
            current_app.logger.exception("Error al crear la nota")
            return jsonify({'error': str(e)}), 500


@clipboard_bp.route('/notes/<int:note_id>', methods=['PUT'])
@login_required
def update_note(note_id):
    """Actualiza una nota"""
    try:
        note = Note.query.filter_by(
            id=note_id,
            user_id=current_user.id
        ).first()
        
        if not note:
            return jsonify({'error': 'Nota no encontrada'}), 404
        
        data = request.get_json()
        print(data)
        
        if 'title' in data:
            note.title = data['title']
        if 'content' in data:
            note.content = data['content']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'note': note.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@clipboard_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@login_required
def delete_note(note_id):
    """Elimina una nota"""
    try:
        note = Note.query.filter_by(
            id=note_id,
            user_id=current_user.id
        ).first()

           # 🔍 DEBUGGING
        print(f"📥 Datos recibidos: {data}")
        print(f"📥 Type de data: {type(data)}")
        print(f"📥 Title: '{data.get('title') if data else None}'")
        print(f"📥 Content: '{data.get('content') if data else None}'")
        
        if not note:
            return jsonify({'error': 'Nota no encontrada'}), 404
        
        db.session.delete(note)
        db.session.commit()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ========== NOTAS CIFRADAS ==========

@clipboard_bp.route('/encrypted-notes', methods=['GET'])
@login_required
def get_encrypted_notes():
    """Obtiene lista de notas cifradas (sin descifrar)"""
    try:
        notes = Note.query.filter_by(
            user_id=current_user.id,
            is_encrypted=True
        ).order_by(Note.created_at.desc()).all()
        
        # No incluimos el contenido, solo metadata
        return jsonify({
            'success': True,
            'notes': [{
                'id': note.id,
                'title': note.title,
                'created_at': note.created_at.isoformat(),
                'updated_at': note.updated_at.isoformat()
            } for note in notes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@clipboard_bp.route('/encrypted-notes', methods=['POST'])
@login_required
def create_encrypted_note():
    """Crea una nota cifrada con contraseña"""
    try:
        data = request.get_json()
        
        if not data.get('title') or not data.get('content') or not data.get('password'):
            return jsonify({'error': 'Título, contenido y contraseña son requeridos'}), 400
        
        if len(data['password']) < 4:
            return jsonify({'error': 'La contraseña debe tener al menos 4 caracteres'}), 400
        
        note = Note(
            user_id=current_user.id,
            title=data['title'],
            is_encrypted=True
        )
        
        # Cifrar contenido
        note.encrypt_content(data['title'], data['password'])
        note.encrypt_content(data['content'], data['password'])
        
        db.session.add(note)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Nota cifrada guardada correctamente',
            'note': {
                'id': note.id,
                'title': note.title,
                'created_at': note.created_at.isoformat()
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@clipboard_bp.route('/encrypted-notes/<int:note_id>/decrypt', methods=['POST'])
@login_required
def decrypt_note(note_id):
    """Descifra una nota si la contraseña es correcta"""
    try:
        note = Note.query.filter_by(
            id=note_id,
            user_id=current_user.id,
            is_encrypted=True
        ).first()
        
        if not note:
            return jsonify({'error': 'Nota no encontrada'}), 404
        
        data = request.get_json()
        password = data.get('password')
        
        if not password:
            return jsonify({'error': 'Contraseña requerida'}), 400
        
        try:
            content = note.decrypt_content(password)
            return jsonify({
                'success': True,
                'note': {
                    'id': note.id,
                    'title': note.title,
                    'content': content,
                    'created_at': note.created_at.isoformat()
                }
            }), 200
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@clipboard_bp.route('/encrypted-notes/<int:note_id>', methods=['DELETE'])
@login_required
def delete_encrypted_note(note_id):
    """Elimina una nota cifrada"""
    try:
        note = Note.query.filter_by(
            id=note_id,
            user_id=current_user.id,
            is_encrypted=True
        ).first()
        
        if not note:
            return jsonify({'error': 'Nota no encontrada'}), 404
        
        db.session.delete(note)
        db.session.commit()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@clipboard_bp.route('/encrypted-notes/<int:note_id>', methods=['PUT'])
@login_required
def update_encrypted_note(note_id):
    """Actualiza una nota cifrada si la contraseña es correcta"""
    try:
        note = Note.query.filter_by(
            id=note_id,
            user_id=current_user.id,
            is_encrypted=True
        ).first()

        if not note:
            return jsonify({'error': 'Nota no encontrada'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Datos requeridos'}), 400

        password = data.get('password')
        title = data.get('title')
        content = data.get('content')

        if not password:
            return jsonify({'error': 'Contraseña requerida'}), 400

        if not title or not content:
            return jsonify({
                'error': 'Título y contenido son requeridos'
            }), 400

        if len(password) < 4:
            return jsonify({
                'error': 'La contraseña debe tener al menos 4 caracteres'
            }), 400

        # Verificar la contraseña descifrando el contenido actual
        try:
            note.decrypt_content(password)
        except ValueError:
            return jsonify({
                'error': 'Contraseña incorrecta'
            }), 401

        # Actualizar el título y volver a cifrar el contenido
        note.title = title
        note.encrypt_content(content, password)

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Nota cifrada actualizada correctamente',
            'note': {
                'id': note.id,
                'title': note.title,
                'created_at': note.created_at.isoformat(),
                'updated_at': note.updated_at.isoformat()
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500