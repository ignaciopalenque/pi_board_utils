import base64
import os
from pathlib import Path, PurePosixPath
import requests
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from urllib.parse import quote

github_sync_bp = Blueprint("github_sync", __name__)

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER")
GITHUB_REPO = os.environ.get("GITHUB_REPO")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

API_BASE = "https://api.github.com"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def github_headers():
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "X-GitHub-Api-Version": "2022-11-28",
    }

'''
def valid_repo_path(raw_path):
    """Permite solo el JSON indicado y archivos bajo app/static/documentos/."""
    if not raw_path or "\\" in raw_path:
        return None

    path = PurePosixPath(raw_path)

    if path.is_absolute() or ".." in path.parts:
        return None

    normalized = path.as_posix()

    if normalized == "app/static/json/documentos.json":
        return normalized

    if normalized.startswith("app/static/documentos/") and len(path.parts) > 3:
        return normalized

    return None
'''


def valid_repo_path(raw_path):
    if not raw_path or "\\" in raw_path:
        return None

    path = PurePosixPath(raw_path)

    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        return None

    normalized = path.as_posix()

    # Permite reemplazar el JSON específico.
    if normalized == "app/static/json/documentos.json":
        return normalized

    # Permite archivos y subcarpetas de documentos.
    if normalized.startswith("app/static/documentos/") and len(path.parts) >= 4:
        return normalized

    return None


@github_sync_bp.post("/api/github/upload-server-folder")
@login_required
def upload_server_folder():
    if getattr(current_user, "role", None) != "admin":
        return jsonify(error="No autorizado"), 403

    source_value = os.environ.get("GITHUB_SOURCE_DIR")
    destination_value = os.environ.get("GITHUB_DESTINATION")

    if not all([GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO,
                source_value, destination_value]):
        return jsonify(error="Falta configurar GitHub o la carpeta de origen"), 500

    source = Path(source_value).resolve()
    destination = PurePosixPath(destination_value)

    if not source.is_dir():
        return jsonify(error="La carpeta configurada no existe en la Raspberry"), 400

    # Solo admite los destinos previstos para este proyecto.
    dest_string = destination.as_posix()
    if dest_string != "documentos":
        return jsonify(error="Destino no permitido"), 400

    files_to_upload = []

    # Recorre subcarpetas, pero no sigue enlaces simbólicos.
    for current_dir, dirnames, filenames in os.walk(source, followlinks=False):
        dirnames[:] = [
            name for name in dirnames
            if not (Path(current_dir) / name).is_symlink()
        ]

        for filename in filenames:
            local_path = Path(current_dir) / filename

            if local_path.is_symlink() or not local_path.is_file():
                continue

            relative_path = local_path.relative_to(source).as_posix()
            repo_path = f"{dest_string}/{relative_path}"
            files_to_upload.append((local_path, repo_path))

    if not files_to_upload:
        return jsonify(ok=True, message="La carpeta no contiene archivos"), 200
    


    repo_url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}"

    repo_check = requests.get(
        repo_url,
        headers=github_headers(),
        timeout=20,
    )

    if not repo_check.ok:
        return jsonify(
            error="No se puede acceder al repositorio",
            status_github=repo_check.status_code,
            detalle=repo_check.text[:1000],
        ), 502

    branch_url = f"{repo_url}/branches/{quote(GITHUB_BRANCH, safe='')}"

    branch_check = requests.get(
        branch_url,
        headers=github_headers(),
        timeout=20,
    )

    if not branch_check.ok:
        return jsonify(
            error="No se encuentra o no se puede acceder a la rama configurada",
            status_github=branch_check.status_code,
            rama=GITHUB_BRANCH,
            detalle=branch_check.text[:1000],
        ), 502

    uploaded = []

    for local_path, repo_path in files_to_upload:
        try:
            content = local_path.read_bytes()

            if len(content) > 20 * 1024 * 1024:
                return jsonify(
                    error=f"El archivo supera 20 MB: {repo_path}",
                    subidos=uploaded,
                ), 413

            # Codifica cada segmento para que espacios y caracteres especiales
            # no alteren la ruta de la petición.
            encoded_path = quote(repo_path, safe="/")
            url = (
                f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}"
                f"/contents/{encoded_path}"
            )

            existing = requests.get(
                url,
                headers=github_headers(),
                params={"ref": GITHUB_BRANCH},
                timeout=20,
            )

            if existing.status_code == 200:
                sha = existing.json()["sha"]
            elif existing.status_code == 404:
                sha = None
            else:
                return jsonify(
                    error=f"No se pudo consultar {repo_path} en GitHub",
                    detalle=existing.text[:1000],
                    subidos=uploaded,
                ), 502

            payload = {
                "message": f"Actualizar {repo_path}",
                "content": base64.b64encode(content).decode("ascii"),
                "branch": GITHUB_BRANCH,
            }

            if sha:
                payload["sha"] = sha

            response = requests.put(
                url,
                headers=github_headers(),
                json=payload,
                timeout=30,
            )

            if not response.ok:
                return jsonify(
                    error=f"GitHub rechazó {repo_path}",
                    detalle=response.text[:1000],
                    subidos=uploaded,
                ), 502

            uploaded.append(repo_path)

        except OSError as exc:
            return jsonify(
                error=f"No se pudo leer {local_path}",
                detalle=str(exc),
                subidos=uploaded,
            ), 500
        except requests.RequestException as exc:
            return jsonify(
                error=f"Error de conexión con GitHub: {exc}",
                subidos=uploaded,
            ), 502

    return jsonify(
        ok=True,
        message=f"Se subieron {len(uploaded)} archivos",
        files=uploaded,
    )



@github_sync_bp.post("/api/github/upload")
@login_required
def upload_to_github():
    if getattr(current_user, "role", None) != "admin":
        return jsonify(error="No autorizado"), 403

    if not all([GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO]):
        return jsonify(error="Falta configurar GitHub en el servidor"), 500

    files = request.files.getlist("files")
    paths = request.form.getlist("paths")

    if not files or len(files) != len(paths):
        return jsonify(error="Envía cada archivo junto con su ruta"), 400

    results = []

    for uploaded_file, raw_path in zip(files, paths):
        repo_path = valid_repo_path(raw_path)

        if not repo_path:
            return jsonify(error=f"Ruta no permitida: {raw_path}"), 400

        content = uploaded_file.read()

        if len(content) > MAX_FILE_SIZE:
            return jsonify(error=f"El archivo supera 20 MB: {repo_path}"), 413

        url = (
            f"{API_BASE}/repos/{GITHUB_OWNER}/{GITHUB_REPO}"
            f"/contents/{repo_path}"
        )

        try:
            # Si existe, GitHub devuelve el sha requerido para reemplazarlo.
            existing = requests.get(
                url,
                headers=github_headers(),
                params={"ref": GITHUB_BRANCH},
                timeout=20,
            )

            if existing.status_code == 200:
                sha = existing.json()["sha"]
            elif existing.status_code == 404:
                sha = None
            else:
                return jsonify(
                    error="No se pudo consultar el archivo en GitHub",
                    detail=existing.text[:1000],
                ), 502

            payload = {
                "message": f"Actualizar {repo_path}",
                "content": base64.b64encode(content).decode("ascii"),
                "branch": GITHUB_BRANCH,
            }

            if sha:
                payload["sha"] = sha

            response = requests.put(
                url,
                headers=github_headers(),
                json=payload,
                timeout=30,
            )

            if not response.ok:
                return jsonify(
                    error=f"GitHub rechazó {repo_path}",
                    detail=response.text[:1000],
                ), 502

            results.append(repo_path)

        except requests.RequestException as exc:
            return jsonify(error=f"Error de conexión con GitHub: {exc}"), 502

    return jsonify(
        ok=True,
        message="Archivos enviados a GitHub",
        files=results,
    )
