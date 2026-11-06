import os
import json
from pathlib import Path
from flask import Blueprint, request, current_app, jsonify, send_file, render_template 
from flask_login import login_required, current_user

from werkzeug.utils import secure_filename
from functools import wraps
import shutil





# Crear blueprint con dos prefijos
files_bp = Blueprint('files', __name__)

# ==================== RUTAS DE VISTA ====================

@files_bp.route('/files')
def explorer():
    """Vista del explorador de archivos"""
    return render_template('file_explorer.html')

# ==================== RUTAS DE API ====================

api_prefix = '/api/files'

def get_allowed_root():
    """Obtiene la raíz permitida del usuario actual"""
    if not current_user.is_authenticated:
        return os.path.expanduser('~')
    
    # Si el usuario tiene un root_path configurado, usarlo
    if current_user.root_path:
        return current_user.root_path
    
    # Si no, usar el home del usuario
    return os.path.expanduser('~')

def save_root_path(path):
    """Guarda la ruta raíz en configuración"""
    print(path)
    if not os.path.isdir(path):
        return False
    
  
    if current_user.set_root_path(path):
        return True
    else:
        return False



def validate_path(requested_path, root_path):
    """
    Valida que la ruta solicitada esté dentro de root_path
    Previene path traversal attacks
    """
    root = Path(root_path).resolve()
    requested = Path(requested_path).resolve()
    
    try:
        requested.relative_to(root)
        return True
    except ValueError:
        return False

def require_valid_path(f):
    """Decorator para validar rutas"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        root_path = get_allowed_root()
        current_path = request.args.get('path', root_path)
        
        if not validate_path(current_path, root_path):
            return jsonify({'error': 'Ruta no permitida'}), 403
        
        kwargs['root_path'] = root_path
        kwargs['current_path'] = current_path
        return f(*args, **kwargs)
    return decorated_function

# ==================== RUTAS API ====================

@files_bp.route('/api/files/set-root', methods=['POST'])
@login_required
def set_root():
    """Establece la carpeta raíz del explorador"""
    print("Establece carpeta raiz")
    data = request.get_json()

      # ✓ Validar que es JSON
    if not request.is_json:
        return jsonify({'error': 'Content-Type debe ser application/json'}), 400
    
    data = request.get_json()
    
    # ✓ Validar que JSON es válido
    if data is None:
        return jsonify({'error': 'JSON inválido'}), 400

    root_path = data.get('path', '').strip()


    if not root_path:
        return jsonify({'error': 'Ruta vacía'}), 400
    
    # Expandir ~ si es necesario
    root_path = os.path.expanduser(root_path)
    
    if not os.path.isdir(root_path):
        return jsonify({'error': 'La carpeta no existe'}), 400
    
    # Verificar permisos
    if not os.access(root_path, os.R_OK | os.W_OK):
        return jsonify({'error': 'Permisos insuficientes'}), 403
    
    if save_root_path(root_path):
        return jsonify({
            'success': True,
            'path': root_path
        }), 200
    
    return jsonify({'error': 'No se pudo guardar la configuración'}), 500

@files_bp.route('/api/files/get-root', methods=['GET'])
def get_root():
    """Obtiene la carpeta raíz actual"""
    root_path = get_allowed_root()
    stats = shutil.disk_usage(root_path)
    total = stats.total / (1024**3)      # GB
    used = stats.used / (1024**3)       # GB
    free = stats.free / (1024**3)  # GB

    return jsonify({
        'path': root_path,
        'exists': os.path.isdir(root_path),
        'total': round(total, 2),
        'used' : round(used, 2),
        'free' : round(free, 2)
    }), 200

@files_bp.route('/api/files/list', methods=['GET'])
@require_valid_path
def list_files(root_path, current_path):
    """Lista los archivos y carpetas en la ruta actual"""
    try:
        items = {
            'folders': [],
            'files': [],
            'currentPath': current_path,
            'rootPath': root_path
        }
        
        for item in os.listdir(current_path):
            item_path = os.path.join(current_path, item)
            
            # Saltar archivos/carpetas ocultos en Linux
            if item.startswith('.'):
                continue
            
            try:
                stat_info = os.stat(item_path)
                size = stat_info.st_size
                modified = stat_info.st_mtime
                
                if os.path.isdir(item_path):
                    items['folders'].append({
                        'name': item,
                        'path': item_path,
                        'modified': modified
                    })
                else:
                    items['files'].append({
                        'name': item,
                        'path': item_path,
                        'size': size,
                        'modified': modified
                    })
            except Exception as e:
                print(f"Error al procesar {item}: {e}")
                continue
        
        # Ordenar alfabéticamente
        items['folders'].sort(key=lambda x: x['name'].lower())
        items['files'].sort(key=lambda x: x['name'].lower())
        
        return jsonify(items), 200
    
    except PermissionError:
        return jsonify({'error': 'Permisos denegados'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@files_bp.route('/api/files/create-folder', methods=['POST'])
@require_valid_path
def create_folder(root_path, current_path):
    """Crea una nueva carpeta"""
    data = request.get_json()
    folder_name = secure_filename(data.get('name', '').strip())
    
    if not folder_name:
        print("Error al crear carpeta")
        return jsonify({'error': 'Nombre de carpeta inválido'}), 400
    
    new_folder_path = os.path.join(current_path, folder_name)
    
    if os.path.exists(new_folder_path):
        return jsonify({'error': 'La carpeta ya existe'}), 409
    
    try:
        os.makedirs(new_folder_path, mode=0o755)
        return jsonify({
            'success': True,
            'path': new_folder_path,
            'name': folder_name
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@files_bp.route('/api/files/upload', methods=['POST'])
@require_valid_path
def upload_file(root_path, current_path):
    """Sube un archivo"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_path, filename)
    
    # Evitar sobrescrituras accidentales
    if os.path.exists(filepath):
        name, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(filepath):
            filepath = os.path.join(current_path, f"{name}_{counter}{ext}")
            counter += 1
    
    try:
        # Limitar tamaño (ej: 500MB para Raspberry Pi)
        '''
        max_size = 500 * 1024 * 1024
        if file.content_length and file.content_length > max_size:
            return jsonify({'error': 'Archivo demasiado grande'}), 413
        '''
        file.save(filepath)
        os.chmod(filepath, 0o644)
        
        return jsonify({
            'success': True,
            'path': filepath,
            'name': os.path.basename(filepath)
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@files_bp.route('/api/files/download', methods=['GET'])
@require_valid_path
def download_file(root_path, current_path):
    """Descarga un archivo"""
    file_path = request.args.get('file', '').strip()
    
    if not validate_path(file_path, root_path):
        return jsonify({'error': 'Ruta no permitida'}), 403
    
    if not os.path.isfile(file_path):
        return jsonify({'error': 'Archivo no encontrado'}), 404
    
    try:
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path)
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@files_bp.route('/api/files/delete', methods=['DELETE'])
@require_valid_path
def delete_item(root_path, current_path):
    """Elimina un archivo o carpeta"""
    data = request.get_json()
    item_path = data.get('path', '').strip()
    
    if not validate_path(item_path, root_path):
        return jsonify({'error': 'Ruta no permitida'}), 403
    
    if not os.path.exists(item_path):
        return jsonify({'error': 'Elemento no encontrado'}), 404
    
    try:
        if os.path.isfile(item_path):
            os.remove(item_path)
        elif os.path.isdir(item_path):
            shutil.rmtree(item_path)
        
        return jsonify({'success': True}), 200
    
    except PermissionError:
        return jsonify({'error': 'Permisos denegados'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@files_bp.route('/api/files/rename', methods=['POST'])
@require_valid_path
def rename_item(root_path, current_path):
    """Renombra un archivo o carpeta"""
    data = request.get_json()
    old_path = data.get('oldPath', '').strip()
    new_name = secure_filename(data.get('newName', '').strip())
    
    if not validate_path(old_path, root_path) or not new_name:
        return jsonify({'error': 'Datos inválidos'}), 400
    
    if not os.path.exists(old_path):
        return jsonify({'error': 'Elemento no encontrado'}), 404
    
    parent_dir = os.path.dirname(old_path)
    new_path = os.path.join(parent_dir, new_name)
    
    if os.path.exists(new_path):
        return jsonify({'error': 'El nombre ya existe'}), 409
    
    try:
        os.rename(old_path, new_path)
        return jsonify({
            'success': True,
            'newPath': new_path
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@files_bp.before_request
def debug_files_request():
    print(
        ">>> PETICIÓN AL BLUEPRINT:",
        request.method,
        request.path,
        flush=True
    )


TEXT_EXTENSIONS = {
    ".txt", ".md", ".json", ".py", ".html", ".css",
    ".js", ".csv", ".xml", ".yml", ".yaml", ".ini", ".log",
}
MAX_FILE_BYTES = 1_000_000  # 1 MB


def get_editable_file(relative_path):
    if not current_user.root_path:
        root_path=os.path.expanduser('~')
    else:
        root_path=current_user.root_path

    root = Path(root_path).resolve()
    candidate = (root / relative_path).resolve()

    # Impide acceder fuera de la carpeta autorizada.
    try:
        candidate.relative_to(root)
    except ValueError:
        return None

    if candidate.suffix.lower() not in TEXT_EXTENSIONS:
        return None

    return candidate


@files_bp.get(f"{api_prefix}/content")
@login_required
def read_text_file():
    relative_path = request.args.get("path", "")
    path = get_editable_file(relative_path)

    if path is None:
        print("sin ruta")
        return jsonify(error="Ruta o tipo de archivo no permitido"), 403
    if not path.is_file():
        print("archivo no encontrado")
        return jsonify(error="Archivo no encontrado"), 404
    
    if path.stat().st_size > MAX_FILE_BYTES:
        return jsonify(error="El archivo supera el tamaño permitido"), 413

    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return jsonify(error="El archivo no es texto UTF-8 válido"), 415
    except OSError:
        return jsonify(error="No se pudo leer el archivo"), 500

    return jsonify(content=content)


@files_bp.put(f"{api_prefix}/content")
@login_required
def write_text_file():
    data = request.get_json(silent=True) or {}
    relative_path = data.get("path")
    content = data.get("content")

    if not isinstance(relative_path, str) or not isinstance(content, str):
        return jsonify(error="Datos inválidos"), 400

    if len(content.encode("utf-8")) > MAX_FILE_BYTES:
        return jsonify(error="El contenido supera el tamaño permitido"), 413

    path = get_editable_file(relative_path)

    if path is None:
        return jsonify(error="Ruta o tipo de archivo no permitido"), 403
    if not path.is_file():
        return jsonify(error="Archivo no encontrado"), 404

    try:
        path.write_text(content, encoding="utf-8")
    except OSError:
        return jsonify(error="No se pudo guardar el archivo"), 500

    return jsonify(ok=True)