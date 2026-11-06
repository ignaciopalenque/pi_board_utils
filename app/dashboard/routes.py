import platform
import socket
import time
import psutil
from pathlib import Path
from flask import Blueprint, jsonify, render_template
from flask_login import login_required
import cpuinfo

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
    CPU_INFO = cpuinfo.get_cpu_info()
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    plan = powerGetCost.get_energy_plan()
    tdp = powerGetCost.get_tdp_smart()
    cpu_name = CPU_INFO.get('brand_raw', 'Unknown')
    boot_time_h, boot_time_m = powerGetCost.get_boot_time()
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

    if "CORTEX-A53" in cpu_name.upper():
        freq_file = Path(
            "/sys/devices/system/cpu/cpufreq/policy0/scaling_cur_freq"
            )
        cpu_freq = int(freq_file.read_text().strip()) / 1000

    else:
        cpu_freq = psutil.cpu_freq().current


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
        "cpu_name": cpu_name,
        "cpu_freq": cpu_freq,
        "memory": memory.percent,
        "memory_used": memory.used / (1024 ** 3),
        "memory_total": memory.total / (1024 ** 3),
        "disk": disk.percent,
        "disk_free": disk.free,
        "network_rx": net.bytes_recv,
        "network_tx": net.bytes_sent,
        "temperature": temperature,
        "uptime": time.time() - psutil.boot_time(),
        "process": top_processes,
        "plan" : plan,
        "boot_time_h": boot_time_h,
        "boot_time_m": boot_time_m,
        "tdp": tdp
    })


@dashboard_bp.route("/api/powerCost")
@login_required
def powerCost():
    return powerGetCost.getPowerCost()