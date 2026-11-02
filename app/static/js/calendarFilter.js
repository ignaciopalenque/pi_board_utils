const filtroProyecto = document.querySelector("#filtroProyecto");
const filtroFechaInicio = document.querySelector("#filtroFechaInicio");
const filtroFechaFin = document.querySelector("#filtroFechaInicio");
const filtroEstado = document.querySelector("#filtroEstado");
const tablaTareas = document.querySelector("#tablaTareas");
const mensajeTabla = document.querySelector("#mensajeTabla");
const dialog = document.getElementById("task-dialog");
const form = document.getElementById("task-form");
const taskId = document.getElementById("task-id");
const taskInput = document.getElementById("task");
const projectInput = document.getElementById("project");
const descriptionInput = document.getElementById("description");
const statusInput = document.getElementById("status");
const dateInputInicio = document.getElementById("task-date-inicio");
const dateInputFin = document.getElementById("task-date-fin");
const titleEl = document.getElementById("dialog-title");
const errorEl = document.getElementById("form-error");
const deleteBtn = document.getElementById("delete-btn");
const saveBtn = document.getElementById("save-btn");
const tasksUrl = document.getElementById(
            "calendar-config"
        ).dataset.tasksUrl;


let tareas = [];

    async function api(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error || "No se pudo completar la operación."
            );
        }


        return result;
    }

async function cargarTareas() {
    try {
        const response = await fetch("/api/tasks");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "No se pudieron cargar las tareas");
        }

        tareas = data.map(item => ({
            id: item.id || "",
            task: item.title || "",
            project: item.extendedProps?.project || "",
            description: item.extendedProps?.description || "",
            status: item.extendedProps?.status || "",
            start_date: item.start || "",
            end_date: item.end || ""

        }));        
        cargarOpciones(filtroProyecto, tareas.map(t => t.project));
        cargarOpciones(filtroEstado, tareas.map(t => t.status));
        aplicarFiltros();
    } catch (error) {
        mensajeTabla.textContent = error.message;
    }
}


function openEditTask(event) {
        selectedEvent = event;

        taskId.value = event.id;
        taskInput.value = event.task;
        projectInput.value = event.project || "";
        descriptionInput.value =
            event.description || "";
        statusInput.value =
            event.status || "pendiente";
        dateInputInicio.value = event.start_date;
        dateInputFin.value = event.end_date;

        titleEl.textContent = "Editar tarea";
        deleteBtn.hidden = false;
        saveBtn.disabled = false;
        errorEl.textContent = "";


        if (event.status == "completada"){
         
            estadoEditComponentes(true);
        }

        dialog.showModal();
    }


statusInput.addEventListener('change', function() {
            if(statusInput.value =="completada"){
                estadoEditComponentes(true)
            }else{
                estadoEditComponentes(false)

            }
        });

function estadoEditComponentes(estado){

        try {
            taskInput.disabled = estado;
            projectInput.disabled = estado;
            descriptionInput.disabled = estado;
            dateInputInicio.disabled = estado;
            dateInputFin.disabled = estado;
        } catch (error) {
            
        }

    }


async function deleteTask() {
    const id = taskId.value;

    if (!id) {
        return;
    }

    deleteBtn.disabled = true;

    const csrfToken = document.querySelector(
        'meta[name="csrf-token"]'
    )?.getAttribute("content");

    try {
        await api(`${tasksUrl}/${id}`, {
            method: "DELETE",
            headers: {
                "X-CSRFToken": csrfToken,
            },
        });

        dialog.close();
        calendar.refetchEvents();

    } catch (error) {
        errorEl.textContent = error.message;

    } finally {
        deleteBtn.disabled = false;
    }
}

async function deleteItemConfirm() {
    dialog.close();

    const result = await Swal.fire({
        title: "Eliminar tarea",
        text: "¿Estás seguro de que deseas eliminar esta tarea?",
        icon: "question",
        showCancelButton: true,
        focusConfirm: true,
        theme: "dark",
        confirmButtonColor: "#39ff88",
        cancelButtonColor: "#a20e22",
        confirmButtonText: "Aceptar",
        cancelButtonText: "Cancelar",
    });

    // Si cancela, no hacemos nada y el modal permanece abierto.
    if (!result.isConfirmed) {
        dialog.showModal();
        return;
    }

    // Solo borramos si confirma.
    await deleteTask();
}


function cargarOpciones(select, valores) {
    const valoresUnicos = [...new Set(valores.filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    for (const valor of valoresUnicos) {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = valor;
        select.appendChild(opcion);
    }
}

function aplicarFiltros() {
    const proyecto = filtroProyecto.value;
    const fechaInicio = filtroFechaInicio.value;
    const fechaFin = filtroFechaFin.value;

    const estado = filtroEstado.value;

    const filtradas = tareas.filter(tarea =>
        (!proyecto || tarea.project === proyecto) &&
        (!fechaInicio || tarea.start_date === fecha) &&
        (!fechaFin || tarea.end_date === fecha) &&
        (!estado || tarea.status === estado)
    );

    mostrarTareas(filtradas);
}

function mostrarTareas(lista) {
    tablaTareas.replaceChildren();

    mensajeTabla.textContent = lista.length
        ? `${lista.length} tarea(s)`
        : "No se encontraron tareas.";

    for (const tarea of lista) {
        const fila = document.createElement("tr");
        
        for (const valor of [
            tarea.task,
            tarea.project,
            tarea.description || "",
            tarea.status,
            tarea.start_date,
            tarea.end_date
        ]) {
            const celda = document.createElement("td");
            celda.textContent = valor;
                
            if (valor === 'completada') {
                        fila.classList.add('task-completada');
                    } else if (valor === 'pendiente') {
                        fila.classList.add('task-pendiente');
                    } else if (valor === 'en_progreso') {
                        fila.classList.add('task-progreso');
                    }
                    
            fila.appendChild(celda);

           
        }



        tablaTareas.appendChild(fila);

        fila.addEventListener("click",()=>{
                openEditTask(tarea)
            })
    }
}

filtroProyecto.addEventListener("change", aplicarFiltros);
filtroFechaInicio.addEventListener("input", aplicarFiltros);
filtroFechaFin.addEventListener("input", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);
deleteBtn.addEventListener("click", async () => {
   
        await deleteItemConfirm();


    });

form.addEventListener("submit", async (event) => {
        event.preventDefault();

        errorEl.textContent = "";
        saveBtn.disabled = true;

        const payload = {
            task: taskInput.value.trim(),
            project: projectInput.value.trim(),
            description: descriptionInput.value.trim(),
            status: statusInput.value,
            start_date: dateInputInicio.value,
            end_date: dateInputFin.value

        };

        const id = taskId.value;

               // Obtener el token CSRF desde el HTML
        const csrfToken = document.querySelector(
            'meta[name="csrf-token"]'
        )?.getAttribute('content');

        try {
            await api(
                id ? `${tasksUrl}/${id}` : tasksUrl,
                {   
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify(payload),
                }
            );

            dialog.close();
            Swal.fire({
                title: "Tarea actualizada.",
                text: "Tarea actualizada correctamente",
                icon: "success",
                theme: 'dark'
                }).then(() => {
                    location.reload();
                });
        } catch (error) {
            errorEl.textContent = error.message;
        } finally {
            saveBtn.disabled = false;
        }
    });


document.getElementById("cancel-btn").addEventListener(
        "click",
        () => dialog.close()
    );


document.querySelector("#limpiarFiltros").addEventListener("click", () => {
    filtroProyecto.value = "";
    filtroFechaInicio.value = "";
    filtroFechaFin.value = "";
    filtroEstado.value = "";
    aplicarFiltros();
});

cargarTareas();
