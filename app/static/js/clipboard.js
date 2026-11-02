// ========== VARIABLES GLOBALES ==========

let clipboardElement = document.getElementById("clipboard");
let clipboardStatus = document.getElementById("clipboardStatus");


let clipboardBeingEdited = false;
const STORAGE_KEY = "networkClipboard";
const LAST_UPDATE_KEY = "clipboardLastUpdate";


let passwordResuelve = null;

// Abre el modal y retorna una Promise con la contraseña

async function abrirPasswordModal() {
    const dialog = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    const passwordConfirmInput = document.getElementById('passwordConfirmInput');
    const cancelBtn = document.getElementById('cancelPasswordBtn');
    const submitBtn = document.getElementById('submitPasswordBtn');
    const togglePassword = document.getElementById('togglePassword');
    const togglePasswordConfirm = document.getElementById('togglePasswordConfirm');
    const confirmHelp = document.getElementById('confirmHelp');
    const strengthBar = document.querySelector('.password-strength-bar');
    const strengthText = document.querySelector('.password-strength-text');
    const passwordForm = document.getElementById('passwordForm');

    // Toggle visibility
    togglePassword.addEventListener('click', (e) => {
        e.preventDefault();
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        togglePassword.textContent = passwordInput.type === 'password' ? '👁' : '👁‍🗨';
    });

    togglePasswordConfirm.addEventListener('click', (e) => {
        e.preventDefault();
        passwordConfirmInput.type = passwordConfirmInput.type === 'password' ? 'text' : 'password';
        togglePasswordConfirm.textContent = passwordConfirmInput.type === 'password' ? '👁' : '👁‍🗨';
    });

    // Fortaleza de contraseña
    passwordInput.addEventListener('input', () => {
        const strength = evaluatePasswordStrength(passwordInput.value);
        strengthBar.className = 'password-strength-bar password-strength-' + strength.level;
        strengthText.className = 'password-strength-text password-strength-' + strength.level;
        strengthText.textContent = 'Fortaleza: ' + strength.text;
        validatePasswords();
    });

    passwordConfirmInput.addEventListener('input', validatePasswords);

    function validatePasswords() {
        const match = passwordInput.value === passwordConfirmInput.value && passwordInput.value.length >= 8;
        if (passwordInput.value && passwordConfirmInput.value) {
            if (match) {
                confirmHelp.className = 'password-form-help password-form-help-success';
                confirmHelp.textContent = '✓ Las contraseñas coinciden';
                submitBtn.disabled = false;
            } else {
                confirmHelp.className = 'password-form-help password-form-help-error';
                confirmHelp.textContent = '✗ Las contraseñas no coinciden';
                submitBtn.disabled = true;
            }
        } else {
            confirmHelp.textContent = '';
            submitBtn.disabled = true;
        }
    }

    function evaluatePasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[!@#$%^&*]/.test(password)) strength++;

        if (strength <= 2) return { level: 'weak', text: 'Débil' };
        if (strength <= 4) return { level: 'medium', text: 'Media' };
        return { level: 'strong', text: 'Fuerte' };
    }

    // Abrir modal
    dialog.showModal();

    return new Promise((resolve) => {
        cancelBtn.onclick = () => {
            dialog.close();
            resolve(null);
        };

        submitBtn.onclick = (e) => {
            e.preventDefault();
            const password = passwordInput.value;
            dialog.close();
            resolve(password);
        };

        dialog.onclose = () => {
            if (!submitBtn.onclick.called) resolve(null);
        };
    });
}

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



// Guardar con Ctrl + Enter
clipboardElement.addEventListener("keydown", event => {
    if (event.ctrlKey && event.key === "Enter") {
        saveClipboard();
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




// ========== NOTAS SIN CIFRAR ==========

async function guardarNota() {
    const title = document.getElementById('notaTitle').value.trim();
    const content = document.getElementById('notaText').value.trim();

     if (!title || !content) {
        alertSweetError('Por favor completa título y contenido');
        return;
    }

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        const response = await fetch('/api/clipboard/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                title: title,
                content: content
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al guardar');
        }


        document.getElementById('notaTitle').value = '';
        document.getElementById('notaText').value = '';

        alertSweetConfirm()
        cargarNotas();
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function cargarNotas() {
    try {
        const response = await fetch('/api/clipboard/notes');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al cargar');
        }

         const notasCount = document.getElementById("notasCount")       
        notasCount.textContent = "Total notas guardadas : "+data.notes.length         
    } catch (error) {
        console.error(error);
    }
}



function crearContenedor() {
    const container = document.createElement('div');
    container.id = 'notasContainer';
    container.className = 'notas-container';
    document.querySelector('.translation-section').appendChild(container);
    return container;
}


// ========== NOTAS CIFRADAS ==========

async function guardarNotaCifrada() {
    // Obtener datos de la nota
    const titleInput = document.getElementById('notaTitle');
    const contentInput = document.getElementById('notaText');
    
    if (!titleInput.value.trim() || !contentInput.value.trim()) {
        alertSweetError('Por favor completa título y contenido');
        return;
    }
    
    // Abrir modal de contraseña
    const password = await abrirPasswordModal();
    
    if (!password) {
        console.log('Cifrado cancelado');
        return;
    }
    
    // Mostrar indicador de carga
    const submitBtn = document.getElementById('submitPasswordBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Cifrando...';
    
    try {
        // Obtener CSRF token
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        
        // Preparar datos
        const data = {
            title: titleInput.value.trim(),
            content: contentInput.value.trim(),
            password: password
        };
        
        // Enviar al servidor
        const response = await fetch('/api/clipboard/encrypted-notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken || ''
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Error ${response.status}`);
        }
        
        const result = await response.json();
        
   
        Swal.fire({
                    title: "Nota guardada.",
                    text: "Nota cifrada guardada correctamente",
                    icon: "success",
                    theme: 'dark'
                }).then(() => {
                    location.reload(); // Recarga cuando se cierra la alerta
                });

        
    } catch (error) {
        console.error('Error al guardar nota cifrada:', error);
        alert(`✗ Error: ${error.message}`);
    } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}


function alertSweetError(error){

        Swal.fire({
        title: "Error",
        text: error,
        icon: "error",
        theme:'dark',

        });
}

async function cargarNotasCifradas() {
    try {
        const response = await fetch('/api/clipboard/encrypted-notes');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al cargar');
        }
        const notasCripCount = document.getElementById("notasCripCount")       
        notasCripCount.textContent = "Total notas guardadas : "+data.notes.length         
    } catch (error) {
        console.error(error);
    }
}




async function copiarContenidoNota(content) {
    try {
        await navigator.clipboard.writeText(content);
        showMessage('✓ Contenido copiado al portapapeles');
    } catch (error) {
        showMessage('No se pudo copiar', true);
    }
}


// ========== EVENT LISTENERS (Agregar al final) ==========

document.getElementById('guardarNotaButton')
    .addEventListener('click', guardarNota);

document.getElementById('guardarNotaCifrada')
    .addEventListener('click', guardarNotaCifrada);

// Atajos de teclado
document.getElementById('notaText').addEventListener('keydown', event => {
    if (event.ctrlKey && event.key === 'Enter') {
        guardarNota();
    }
    if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        guardarNotaCifrada();
    }
});

// Cargar notas al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarNotas();
    cargarNotasCifradas();
});





