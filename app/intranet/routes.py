from flask import Flask, request, jsonify,Blueprint, current_app, render_template
from pathlib import Path
from datetime import datetime, timezone
import json

intranet_bp = Blueprint("intranet", __name__)
@intranet_bp.route('/intranet')
def intranetDocs():
    """Vista del explorador de archivos"""
    return render_template('intraDocs.html')