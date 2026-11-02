


// ========== NOTAS CIFRADAS ==========
const dialogN = document.getElementById('notaDialogC');
const btnDelNote = document.getElementById("btnDelNoteC")
const btnUpdNote = document.getElementById("btnUpdNote")
let notaId = ''
let passwordN = ''

 btnDelNote.addEventListener('click',() => {
    if(!notaId=='')
    dialogN.close()
    eliminarNotaCifrada(notaId)
    })

async function cargarNotasCifradas() {
    try {
        const response = await fetch('/api/clipboard/encrypted-notes');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al cargar');
        }

        mostrarNotasCifradas(data.notes);
    } catch (error) {
        console.error(error);
    }
}

function mostrarNotasCifradas(notes) {
    const container = document.getElementById('notasCifradasContainer') || crearContenedorCifrado();
    container.innerHTML = '';

    if (notes.length === 0) {
        container.innerHTML = '<p style="color: #999;">No hay notas cifradas</p>';
        return;
    }

    notes.forEach(note => {
        const notaDiv = document.createElement('div');
        notaDiv.className = 'nota-item cifrada';
        notaDiv.innerHTML = `
            <div class="nota-header">
                <h4>🔐 ${note.title}</h4>
            </div>
            <button class="btn-desbloquear" onclick="desbloquearNota(${note.id})">🔓 Desbloquear</button>
            <small>${new Date(note.created_at).toLocaleString()}</small>
        `;
        container.appendChild(notaDiv);
    });
}

function crearContenedorCifrado() {
    const container = document.createElement('div');
    container.id = 'notasCifradasContainer';
    container.className = 'notas-container cifradas';
    
    const titulo = document.createElement('h3');
    titulo.textContent = '🔐 Notas Cifradas';
    titulo.style.marginTop = '20px';
    titulo.style.borderTop = '1px solid #555';
    titulo.style.paddingTop = '15px';
    
    document.querySelector('.translation-section').appendChild(titulo);
    document.querySelector('.translation-section').appendChild(container);
    return container;
}


async function abrirPasswordModal() {
    const dialog = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('passwordInput');
    const passwordConfirmInput = document.getElementById('passwordConfirmInput');
    const cancelBtn = document.getElementById('cancelPasswordBtn');
    const submitBtn = document.getElementById('submitPasswordBtn');
    const togglePassword = document.getElementById('togglePassword');
    const togglePasswordConfirm = document.getElementById('togglePasswordConfirm');
    const confirmHelp = document.getElementById('confirmHelp');


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


    // Abrir modal
    dialog.showModal();

    return new Promise((resolve) => {
        cancelBtn.onclick = () => {
            dialog.close();
            resolve(null);
        };

        submitBtn.onclick = (e) => {
            e.preventDefault();
            passwordN = passwordInput.value
            dialog.close();
            resolve(passwordN);
        };

        dialog.onclose = () => {
            passwordConfirmInput.value = ""
            passwordInput.value = ""
            confirmHelp.textContent = ""
            if (!submitBtn.onclick.called) resolve(null);
        };
    });
}



async function desbloquearNota(noteId) {

    
    const password = await abrirPasswordModal();

    if (!password) {
        return;
    }

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        const response = await fetch(`/api/clipboard/encrypted-notes/${noteId}/decrypt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            Swal.fire({
                    title: "Error al desbloquear.",
                    text: "Contraseña incorrecta",
                    icon: "error",
                    theme: 'dark'
                })
            throw new Error(data.error || 'Error al desbloquear');
        }

        Swal.fire({
                    title: "Nota desbloqueada.",
                    text: "Nota desbloqueada correctamente",
                    icon: "success",
                    theme: 'dark'
                }).then(() => {
                    mostrarNotaDesbloqueda(data.note);

                });

    } catch (error) {
        console.log(error)
    }
}

function mostrarNotaDesbloqueda(note) {
    // Llenar el dialog con los datos de la nota
    console.log(note)
    document.getElementById('modalTitle').textContent = note.title;
    document.getElementById('modalBody').textContent = note.content;
    document.getElementById('modalDate').textContent = new Date(note.created_at).toLocaleString();
    notaId = note.id

    // Abrir el dialog
    dialogN.showModal();
}

function alertSweetQuestion(){
    return Swal.fire({
        title: "Eliminar nota",
        text: `¿Estás seguro de que deseas eliminar esta nota?`,
        icon: "question",
        showCancelButton: true,
        focusConfirm: true,
        theme:'dark',
        confirmButtonColor: "#39ff88",
        cancelButtonColor: "#a20e22",
        confirmButtonText: `Aceptar`,
        cancelButtonText: "Cancelar"
    }).then((result) => {
        return !result.isDismissed; // Retorna true si confirma, false si cancela
    });
}

async function eliminarNotaCifrada(noteId) {

    const confirmar = await alertSweetQuestion(); // Espera la respuesta
    if (!confirmar) return; // Si cancela, sale

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        const response = await fetch(`/api/clipboard/encrypted-notes/${noteId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al eliminar');
        }
        Swal.fire({
                    title: "Nota eliminada.",
                    text: "Nota eliminada correctamente",
                    icon: "success",
                    theme: 'dark'
                }).then(() => {
                    location.reload(); // Recarga cuando se cierra la alerta
                });

    } catch (error) {
        showMessage(error.message, true);
    }
}

btnUpdNote.addEventListener('click',()=>{

    const tituloUp = document.getElementById('modalTitle').textContent;
    const notaUp = document.getElementById('modalBody').value;

    editarNotaCifrada(notaId, tituloUp, notaUp,passwordN)


})

async function editarNotaCifrada(noteId, titulo, contenido, password) {
    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        const response = await fetch(`/api/clipboard/encrypted-notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                title: titulo,
                content: contenido,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al actualizar');
        }
        dialogN.close()
        Swal.fire({
            title: "Nota actualizada.",
            text: "Nota actualizada correctamente",
            icon: "success",
            theme: 'dark'
        }).then(() => {
            location.reload();
        });

    } catch (error) {
        showMessage(error.message, true);
    }
}




// Cargar notas al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarNotasCifradas();
});


