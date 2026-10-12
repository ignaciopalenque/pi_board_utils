import os
import json
from pathlib import Path
from flask import Blueprint, request, jsonify, render_template 
from flask_login import login_required, current_user
from sqlalchemy import select
from datetime import date
from ..models import CalendarTask
from ..extensions import db

from werkzeug.utils import secure_filename
from functools import wraps
import shutil

# Crear blueprint con dos prefijos
calendar_bp = Blueprint('calendar', __name__)

VALID_STATUSES = {
    "pendiente",
    "en_progreso",
    "completada",
}

# ==================== RUTAS DE VISTA ====================
@calendar_bp.route('/calendar')
def view():
    """Vista del explorador de archivos"""
    return render_template('calendar.html')

@calendar_bp.route('/calendar/filter')
def viewFilter():
    """Vista del explorador de archivos"""
    return render_template('calendarFilter.html')

@calendar_bp.get("/api/tasks")
def get_tasks():
    """
    Devuelve las tareas dentro del intervalo solicitado
    por FullCalendar.
    """
    start = request.args.get("start")
    end = request.args.get("end")

    stmt = select(CalendarTask)

    if start:
        try:
            start_date = date.fromisoformat(start[:10])
        except ValueError:
            return jsonify({"error": "Fecha inicial inválida"}), 400

        stmt = stmt.where(CalendarTask.task_date >= start_date)

    if end:
        try:
            end_date = date.fromisoformat(end[:10])
        except ValueError:
            return jsonify({"error": "Fecha final inválida"}), 400

        # FullCalendar utiliza normalmente un final exclusivo.
        stmt = stmt.where(CalendarTask.task_date < end_date)

    tasks = db.session.execute(
        stmt.order_by(CalendarTask.task_date)
    ).scalars().all()

    events = []

    for task in tasks:
        events.append({
            "id": str(task.id),
            "title": task.task,
            "start": task.task_date.isoformat(),
            "allDay": True,
            "backgroundColor": {
                "pendiente": "#64748b",
                "en_progreso": "#d97706",
                "completada": "#16a34a",
            }[task.status],
            "borderColor": {
                "pendiente": "#64748b",
                "en_progreso": "#d97706",
                "completada": "#16a34a",
            }[task.status],
            "extendedProps": {
                "project": task.project,
                "description": task.description or "",
                "status": task.status,
            },
        })

    return jsonify(events)


@calendar_bp.post("/api/tasks")
def create_task():
    data = request.get_json(silent=True) or {}

    task_name = data.get("task", "").strip()
    project = data.get("project", "").strip()
    description = data.get("description", "").strip()
    status = data.get("status", "pendiente")
    raw_date = data.get("task_date", "")

    raw_date = data.get("task_date")

    if not isinstance(raw_date, str) or not raw_date.strip():
        return jsonify({
            "error": "La fecha de la tarea es obligatoria."
        }), 400

    try:
        task_date = date.fromisoformat(raw_date.strip())
    except ValueError:
        return jsonify({
            "error": "Fecha no válida. Utiliza el formato YYYY-MM-DD."
        }), 400

    task = CalendarTask(
        task=task_name,
        project=project,
        description=description,
        status=status,
        task_date=task_date,
    )

    try:
        db.session.add(task)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify(task.to_dict()), 201


@calendar_bp.put("/api/tasks/<int:task_id>")
def update_task(task_id):
    task = db.session.get(CalendarTask, task_id)

    if task is None:
        return jsonify({"error": "Tarea no encontrada."}), 404

    data = request.get_json(silent=True) or {}

    if "task" in data:
        name = data["task"]

        if not isinstance(name, str) or not name.strip():
            return jsonify({"error": "El nombre es obligatorio."}), 400

        task.task = name.strip()

    if "project" in data:
        project = data["project"]

        if not isinstance(project, str) or not project.strip():
            return jsonify({"error": "El proyecto es obligatorio."}), 400

        task.project = project.strip()

    if "description" in data:
        description = data["description"]

        if not isinstance(description, str):
            return jsonify({"error": "Descripción no válida."}), 400

        task.description = description.strip()

    if "status" in data:
        status = data["status"]

        if status not in VALID_STATUSES:
            return jsonify({"error": "Estado no válido."}), 400

        task.status = status

    if "task_date" in data:
        try:
            task.task_date = date.fromisoformat(data["task_date"])
        except (ValueError, TypeError):
            return jsonify({"error": "La fecha no es válida."}), 400

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify(task.to_dict())


@calendar_bp.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    print(task_id)
    task = db.session.get(CalendarTask, task_id)

    if task is None:
        return jsonify({"error": "Tarea no encontrada."}), 404

    try:
        db.session.delete(task)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify({"message": "Tarea eliminada correctamente."})

