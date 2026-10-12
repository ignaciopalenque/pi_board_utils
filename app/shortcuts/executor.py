import json
import re
import subprocess
from pathlib import Path

from wakeonlan import send_magic_packet


BASE_DIR = Path(__file__).resolve().parents[2]
SHORTCUTS_FILE = BASE_DIR / "shortcuts.json"


ALLOWED_SSH_COMMANDS = {
    "suspend": "sudo -n /usr/bin/systemctl suspend",
    "reboot": "sudo -n /usr/bin/systemctl reboot",
    "uptime": "/usr/bin/uptime",
}


CREDENTIALS = {
    "servidor_t4400": {
        "host": "192.168.100.62",
        "user": "nacho",
        "key": "/var/lib/intranet/.ssh/id_ed25519",
    }
}


MAC_PATTERN = re.compile(
    r"^[0-9A-Fa-f]{2}"
    r"(:[0-9A-Fa-f]{2}){5}$"
)


def load_shortcuts():
    with open(SHORTCUTS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def find_shortcut(shortcut_id):
    for shortcut in load_shortcuts():
        if shortcut["id"] == shortcut_id:
            return shortcut

    return None


def execute_shortcut(shortcut):
    shortcut_type = shortcut.get("type")

    if shortcut_type == "wakeonlan":
        return execute_wol(shortcut)

    if shortcut_type == "ssh":
        return execute_ssh(shortcut)

    raise ValueError("Tipo de acceso directo no permitido")


def execute_wol(shortcut):
    mac = shortcut.get("mac", "")

    if not MAC_PATTERN.fullmatch(mac):
        raise ValueError("Dirección MAC no válida")

    send_magic_packet(mac)

    return {
        "success": True,
        "message": f"Paquete Wake-on-LAN enviado a {mac}",
    }


def execute_ssh(shortcut):
    credential_id = shortcut.get("credential")
    command_id = shortcut.get("command_id")

    credential = CREDENTIALS.get(credential_id)
    command = ALLOWED_SSH_COMMANDS.get(command_id)

    if credential is None:
        raise ValueError("Credencial SSH no permitida")

    if command is None:
        raise ValueError("Comando SSH no permitido")

    ssh_args = [
        "/usr/bin/ssh",
        "-i",
        credential["key"],
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
        "-o",
        "StrictHostKeyChecking=yes",
        f'{credential["user"]}@{credential["host"]}',
        command,
    ]

    result = subprocess.run(
        ssh_args,
        capture_output=True,
        text=True,
        timeout=shortcut.get("timeout", 15),
        check=False,
    )

    return {
        "success": result.returncode == 0,
        "message": result.stdout.strip(),
        "error": result.stderr.strip(),
        "returncode": result.returncode,
    }
