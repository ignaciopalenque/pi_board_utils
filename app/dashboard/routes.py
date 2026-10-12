import platform
import socket
import time
import psutil
from flask import Blueprint, jsonify, render_template
from flask_login import login_required

from .powerCost import powerGetCost

dashboard_bp = Blueprint(
    "dashboard",
    __name__,
    url_prefix="/dashboard"
)

@dashboard_bp.route('/clipboard-html')
def get_clipboard_html():
    return render_template('clipboard.html')


@dashboard_bp.route("/")
@login_required
def index():
    return render_template("dashboard.html")


@dashboard_bp.route("/api/metrics")
@login_required
def metrics():
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    plan = powerGetCost.get_energy_plan()
    # Temperatura
    temperature = None
    temps = psutil.sensors_temperatures()
    for entries in temps.values():
        if entries:
            temperature = entries[0].current
            break

    # CPU count UNA sola vez
    cpu_count = psutil.cpu_count() or 1

    # Obtener CPU global (intervalo corto)
    cpu_percent = psutil.cpu_percent(interval=0.1)

    # Procesos: solo un bucle, sin sleep
    process = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            info = proc.info
            cpu_raw = info.get('cpu_percent') or 0
            mem = info.get('memory_info')
            mem_mb = mem.rss / (1024 * 1024) if mem else 0

            process.append({
                'pid': info['pid'],
                'name': info['name'],
                'cpu_percent': round(cpu_raw / cpu_count, 2),
                'memory_mb': round(mem_mb, 2)
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, AttributeError):
            continue

    # Ordenar y quedarse con los 5 primeros
    top_processes = sorted(process, key=lambda x: x['cpu_percent'], reverse=True)[:5]

    return jsonify({
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "cpu": cpu_percent,
        "memory": memory.percent,
        "memory_used": memory.used,
        "memory_total": memory.total,
        "disk": disk.percent,
        "disk_free": disk.free,
        "network_rx": net.bytes_recv,
        "network_tx": net.bytes_sent,
        "temperature": temperature,
        "uptime": time.time() - psutil.boot_time(),
        "process": top_processes,
        "plan" : plan
    })


@dashboard_bp.route("/api/powerCost")
@login_required
def powerCost():
    return powerGetCost.getPowerCost()