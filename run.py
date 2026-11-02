from app import create_app
import os
from dotenv import load_dotenv

# Cargar variables del archivo .env
load_dotenv()
app = create_app()

if __name__ == "__main__":
      # Usar valores por defecto si las variables no existen
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False') == 'True'
    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug
    )
