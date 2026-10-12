// ========== VARIABLES GLOBALES ==========

let clipboardElement = document.getElementById("clipboard");
let clipboardStatus = document.getElementById("clipboardStatus");
let translatedTextElement = document.getElementById("translatedText");
let languageSelector = document.getElementById("languageSelector");
let translateButton = document.getElementById("translateButton");

let clipboardBeingEdited = false;
const STORAGE_KEY = "networkClipboard";
const LAST_UPDATE_KEY = "clipboardLastUpdate";

// ========== FUNCIONES DE ALMACENAMIENTO ==========

async function saveClipboard() {
    try {
         const csrfToken = document.querySelector(
        'meta[name="csrf-token"]'
        )?.getAttribute('content');

        if (!csrfToken) {
            this.showError('No se ha encontrado el token CSRF');
            return;
        }

        const response = await fetch("/api/clipboard", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json", 'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                text: clipboardElement.value
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "No se pudo guardar");
        }

        clipboardStatus.textContent =
            `Guardado: ${new Date(data.updated_at).toLocaleString()}`;

        showMessage("Portapapeles guardado correctamente");
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function loadClipboard() {
    try {
        const response = await fetch("/api/clipboard");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "No se pudo cargar");
        }

        clipboardElement.value = data.text || "";

   
        clipboardStatus.textContent = data.updated_at
            ? `Cargado correctamente : ${new Date(data.updated_at).toLocaleString()}`
            : "Todavía no hay contenido guardado.";


        if (clipboardElement.value == ""){
            clipboardStatus.textContent = "Todavía no hay contenido guardado."
        }
        
        clipboardStatus.textContent = `Cargado correctamente : ${new Date(data.updated_at).toLocaleString()}`
        
    } catch (error) {
        showMessage(error.message, true);
    }
}


async function copyClipboard() {
    try {
        await navigator.clipboard.writeText(clipboardElement.value);
        showMessage("✓ Texto copiado al portapapeles local");
    } catch (error) {
        showMessage("El navegador no permite copiar automáticamente", true);
    }
}

// ========== FUNCIONES DE TRADUCCIÓN ==========

async function translateClipboard() {
    const targetLang = languageSelector.value;
    const text = clipboardElement.value.trim();

    if (!targetLang) {
        showMessage("Selecciona un idioma de destino", true);
        return;
    }

    if (!text) {
        showMessage("El portapapeles está vacío", true);
        return;
    }

    translateButton.disabled = true;
    translateButton.textContent = "⏳ Traduciendo...";
    clipboardStatus.classList.remove('error', 'success');

    try {
        // Usar la API pública de LibreTranslate
      const response = await fetch("https://es.libretranslate.com/translate", {
            method: "POST",
            body: JSON.stringify({
                q: "",
                source: "auto",
                target: targetLang,
                format: "text",
                alternatives: 3,
                api_key: ""
            }),
            headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
            throw new Error("Error en la traducción. Intenta de nuevo.");
        }

        const data = await response.json();
        translatedTextElement.value = data.translatedText || "";
        
        const detectedLang = data.detectedLanguage?.language || "auto";
        showMessage(`✓ Traducido correctamente (detectado: ${detectedLang})`);

    } catch (error) {
        showMessage(error.message, true);
        translatedTextElement.value = "";
    } finally {
        translateButton.disabled = false;
        translateButton.textContent = "🌐 Traducir";
    }
}

async function copyTranslated() {
    try {
        const text = translatedTextElement.value;
        
        if (!text) {
            showMessage("No hay texto traducido para copiar", true);
            return;
        }

        await navigator.clipboard.writeText(text);
        showMessage("✓ Traducción copiada al portapapeles local");
    } catch (error) {
        showMessage("No se pudo copiar la traducción", true);
    }
}

// ========== FUNCIONES AUXILIARES ==========

function showMessage(message, isError = false) {
    // Usa una función existente en tu app.js o crear una aquí
    const existingShowMessage = window.showMessage;
    
    if (typeof existingShowMessage === 'function') {
        existingShowMessage(message, isError);
    } else {
        // Fallback si no existe showMessage
        const msgElement = document.createElement('div');
        msgElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${isError ? '#fee' : '#efe'};
            color: ${isError ? '#c00' : '#060'};
            border-radius: 4px;
            border-left: 4px solid ${isError ? '#c00' : '#060'};
            z-index: 9999;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        msgElement.textContent = message;
        document.body.appendChild(msgElement);
        
        setTimeout(() => msgElement.remove(), 3000);
    }
}

// ========== EVENT LISTENERS ==========

clipboardElement.addEventListener("focus", () => {
    clipboardBeingEdited = true;
});

clipboardElement.addEventListener("blur", () => {
    clipboardBeingEdited = false;
});

document.getElementById("loadClipboardButton")
    .addEventListener("click", loadClipboard);

document.getElementById("saveClipboardButton")
    .addEventListener("click", saveClipboard);

document.getElementById("copyClipboardButton")
    .addEventListener("click", copyClipboard);

translateButton.addEventListener("click", translateClipboard);

document.getElementById("copyTranslatedButton")
    .addEventListener("click", copyTranslated);

// Guardar con Ctrl + Enter
clipboardElement.addEventListener("keydown", event => {
    if (event.ctrlKey && event.key === "Enter") {
        saveClipboard();
    }
});

// Traducir con Ctrl + Shift + Enter
clipboardElement.addEventListener("keydown", event => {
    if (event.ctrlKey && event.shiftKey && event.key === "Enter") {
        translateClipboard();
    }
});

// Actualizar automáticamente cada 5 segundos (sincronizar entre pestañas)
setInterval(() => {
    if (!clipboardBeingEdited) {
        loadClipboard();
    }
}, 5000);

// Sincronizar entre pestañas del mismo navegador
window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && !clipboardBeingEdited) {
        loadClipboard();
    }
});

// Cargar al iniciar
loadClipboard();
