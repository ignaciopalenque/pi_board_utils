const filtroProyecto = document.querySelector("#filtroProyecto");
const filtroFecha = document.querySelector("#filtroFecha");
const filtroEstado = document.querySelector("#filtroEstado");
const tablaTareas = document.querySelector("#tablaTareas");
const mensajeTabla = document.querySelector("#mensajeTabla");

let tareas = [];

async function cargarTareas() {
    try {
        const response = await fetch("/api/tasks");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "No se pudieron cargar las tareas");
        }

        tareas = data.map(item => ({
            task: item.title || "",
            project: item.extendedProps?.project || "",
            description: item.extendedProps?.description || "",
            status: item.extendedProps?.status || "",
            task_date: item.start || ""
        }));        
        cargarOpciones(filtroProyecto, tareas.map(t => t.project));
        cargarOpciones(filtroEstado, tareas.map(t => t.status));
        aplicarFiltros();
    } catch (error) {
        mensajeTabla.textContent = error.message;
    }
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
    const fecha = filtroFecha.value;
    const estado = filtroEstado.value;

    const filtradas = tareas.filter(tarea =>
        (!proyecto || tarea.project === proyecto) &&
        (!fecha || tarea.task_date === fecha) &&
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
            tarea.title,
            tarea.project,
            tarea.description || "",
            tarea.status,
            tarea.task_date
        ]) {
            const celda = document.createElement("td");
            celda.textContent = valor;
            fila.appendChild(celda);
        }

        tablaTareas.appendChild(fila);
    }
}

filtroProyecto.addEventListener("change", aplicarFiltros);
filtroFecha.addEventListener("input", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);

document.querySelector("#limpiarFiltros").addEventListener("click", () => {
    filtroProyecto.value = "";
    filtroFecha.value = "";
    filtroEstado.value = "";
    aplicarFiltros();
});

cargarTareas();
