
// ========== NOTAS SIN CIFRAR ==========
const btnDelNote = document.getElementById("btnDelNote")
const btnUpdNote = document.getElementById("btnUpdNote")
let notaId = ''
const dialog = document.getElementById('notaDialog');

 btnDelNote.addEventListener('click',() => {
    if(!notaId=='')
    dialog.close()
    eliminarNota(notaId)
    })

async function cargarNotas() {
    try {
        const response = await fetch('/api/clipboard/notes');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al cargar');
        }

        mostrarNotas(data.notes);
    } catch (error) {
        console.error(error);
    }
}

function mostrarNotas(notes) {
    const container = document.getElementById('notasContainer') || crearContenedor();

    
    container.innerHTML = '';

    notes.forEach(note => {
        const notaDiv = document.createElement('div');
        notaDiv.className = 'nota-item';
        notaDiv.innerHTML = `
            <div class="nota-header">
                <h4>${note.title}</h4>
            </div>
            <p>${note.content.substring(0, 100)}...</p>
            <small>${new Date(note.created_at).toLocaleString()}</small>
        `;

        notaDiv.addEventListener('click', () => verNota(note));

        container.appendChild(notaDiv);
    });
}


function verNota(nota) {
    console.log(nota)
    // Llenar el dialog con los datos de la nota
    document.getElementById('modalTitle').textContent = nota.title;
    document.getElementById('modalBody').textContent = nota.content;
    document.getElementById('modalDate').textContent = new Date(nota.created_at).toLocaleString();
    notaId = nota.id

    // Abrir el dialog
    dialog.showModal();

   
}

// Cerrar al presionar ESC (automático con dialog)
document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.getElementById('notaDialog');

    // Cerrar clickeando en el backdrop
    dialog.addEventListener('click', (e) => {
        const rect = dialog.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
            dialog.close();
        }
    });

 
});

function crearContenedor() {
    const container = document.createElement('div');
    container.id = 'notasContainer';
    container.className = 'notas-container';
    document.querySelector('.translation-section').appendChild(container);
    return container;
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

async function eliminarNota(noteId) {

    const confirmar = await alertSweetQuestion(); // Espera la respuesta
    if (!confirmar) return; // Si cancela, sale

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        const response = await fetch(`/api/clipboard/notes/${noteId}`, {
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

    editarNota(notaId, tituloUp, notaUp)


})
async function editarNota(noteId, titulo, contenido) {
    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        const response = await fetch(`/api/clipboard/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                title: titulo,
                content: contenido
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al actualizar');
        }
        dialog.close()
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
    cargarNotas();
});


