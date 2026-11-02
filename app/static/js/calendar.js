

document.addEventListener("DOMContentLoaded", () => {


    const calendarEl = document.getElementById("calendar");
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



    let selectedEvent = null;

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

       actualizarContadores(result)

        return result;
    }

 function actualizarContadores(tareas) {
    try {
        const contador = tareas.reduce((resultado, tarea) => {
            const estado = (tarea.extendedProps.status || "")
                .trim()
                .toLowerCase();

            resultado[estado] = (resultado[estado] || 0) + 1;

            return resultado;
        }, {});

        document.getElementById("totalPendientes").textContent =
            "Total Pendientes " + (contador["pendiente"] || 0);

        document.getElementById("totalCompletadas").textContent =
            "Total Completadas " + (contador["completada"] || 0);

        document.getElementById("totalEnProgreso").textContent =
            "Total En Progreso " + (contador["en_progreso"] || 0);

        return contador;

    } catch (error) {
        console.error("Error al actualizar los contadores:", error);
    }
}

    function openNewTask(dateStr = "") {
        estadoEditComponentes(false)
        form.reset();

        taskId.value = "";
        selectedEvent = null;

        titleEl.textContent = "Nueva tarea";
        deleteBtn.hidden = true;
        saveBtn.disabled = false;
        errorEl.textContent = "";

        dateInputInicio.value = dateStr || new Date()
            .toLocaleDateString("en-CA");
        dateInputFin.value = dateStr || new Date()
            .toLocaleDateString("en-CA");

        statusInput.value = "pendiente";

        dialog.showModal();
        taskInput.focus();
    }

    function openEditTask(event) {
        selectedEvent = event;
        taskId.value = event.id;
        taskInput.value = event.title;
        projectInput.value = event.extendedProps.project || "";
        descriptionInput.value =
            event.extendedProps.description || "";
        statusInput.value =
            event.extendedProps.status || "pendiente";
        dateInputInicio.value = event.startStr;
        dateInputFin.value = event.endStr;

        titleEl.textContent = "Editar tarea";
        deleteBtn.hidden = false;
        saveBtn.disabled = false;
        errorEl.textContent = "";

        if (event.extendedProps.status == "completada"){
         
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
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        locale: "es",
        firstDay: 1,
        height: "auto",
        editable: true,
        selectable: true,
        dayMaxEvents: true,

        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
        },

        buttonText: {
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
        },

        events: async (info, successCallback, failureCallback) => {
            try {
                const params = new URLSearchParams({
                    start: info.startStr,
                    end: info.endStr,
                });

                const events = await api(
                    `${tasksUrl}?${params.toString()}`
                );

                successCallback(events);
            } catch (error) {
                console.error(error);
                failureCallback(error);
            }
        },

        dateClick(info) {
            openNewTask(info.dateStr.slice(0, 10));
        },

        select(info) {
            openNewTask(info.startStr.slice(0, 10));
            calendar.unselect();
        },

        eventClick(info) {
            openEditTask(info.event);
        },

        eventDrop: async (info) => {
            try {
                await api(`${tasksUrl}/${info.event.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        start_date: info.event.startStr.slice(0, 10),
                        end_date: info.event.endStr.slice(0, 10),

                    }),
                });

                calendar.refetchEvents();
            } catch (error) {
                info.revert();
                alert(error.message);
            }
        },
    });

    calendar.render();

    document.getElementById("new-task-btn").addEventListener(
        "click",
        () => openNewTask()
    );

    document.getElementById("cancel-btn").addEventListener(
        "click",
        () => dialog.close()
    );

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
            end_date: dateInputFin.value,

        };

        console.log(payload)

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
            calendar.refetchEvents();
        } catch (error) {
            errorEl.textContent = error.message;
        } finally {
            saveBtn.disabled = false;
        }
    });

    

    deleteBtn.addEventListener("click", async () => {
   
        await deleteItemConfirm();


    });

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







});

