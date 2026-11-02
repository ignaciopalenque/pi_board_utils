const estado = {
  documentos: [],
  favoritos: obtenerFavoritos(),
};

const rootDoc = ""
const elementos = {
  buscador: document.getElementById("buscador"),
  filtroCategoria: document.getElementById("filtroCategoria"),
  filtroEtiqueta: document.getElementById("filtroEtiqueta"),
  ordenar: document.getElementById("ordenar"),
  soloFavoritos: document.getElementById("soloFavoritos"),
  limpiarFiltros: document.getElementById("limpiarFiltros"),
  botonTema: document.getElementById("botonTema"),
  listaDocumentos: document.getElementById("listaDocumentos"),
  contador: document.getElementById("contador"),
  estadoCarga: document.getElementById("estadoCarga"),
  estadoVacio: document.getElementById("estadoVacio"),
  modalPDF: document.getElementById("modalPDF"),
  tituloPDF: document.getElementById("tituloPDF"),
  visorPDF: document.getElementById("visorPDF"),
  cerrarModal: document.getElementById("cerrarModal")
};

document.addEventListener("DOMContentLoaded", iniciar);

document.getElementById("infoConfig").addEventListener("click",()=>{

   Swal.fire({
                    title: "Información de la configuración",
                    text: "Para añadir un nuevo documento a la intranet, primero hay que añadirlo en el indice documental (/static/documentos.json) y posteriormente subir el documento pdf (/static/documentos)",
                    icon: "info",
                    theme: 'dark'
                });

})


async function iniciar() {
  configurarEventos();

  try {
    const respuesta = await fetch("/static/json/documentos.json");

    if (!respuesta.ok) {
      throw new Error("No se pudo cargar documentos.json");
    }

    estado.documentos = await respuesta.json();

    cargarCategorias();
    cargarEtiquetas();
    renderizar();

    elementos.estadoCarga.textContent =
      `${estado.documentos.length} documentos disponibles`;

  } catch (error) {
    console.error(error);

    elementos.estadoCarga.textContent =
      "Se produjo un error al cargar los documentos";
  }
}

function configurarEventos() {
  elementos.buscador.addEventListener("input", renderizar);
  elementos.filtroCategoria.addEventListener("change", renderizar);
  elementos.filtroEtiqueta.addEventListener("change", renderizar);
  elementos.ordenar.addEventListener("change", renderizar);
  elementos.soloFavoritos.addEventListener("change", renderizar);

  elementos.limpiarFiltros.addEventListener("click", limpiarFiltros);
  elementos.cerrarModal.addEventListener("click", cerrarModal);

  elementos.modalPDF.addEventListener("click", evento => {
    if (evento.target === elementos.modalPDF) {
      cerrarModal();
    }
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
      cerrarModal();
    }
  });
}

function cargarCategorias() {
  const categorias = [...new Set(
    estado.documentos.map(documento => documento.categoria)
  )].sort((a, b) => a.localeCompare(b, "es"));

  categorias.forEach(categoria => {
    const opcion = document.createElement("option");
    opcion.value = categoria;
    opcion.textContent = categoria;

    elementos.filtroCategoria.appendChild(opcion);
  });
}

function cargarEtiquetas() {
  const etiquetas = [...new Set(
    estado.documentos.flatMap(documento => documento.etiquetas || [])
  )].sort((a, b) => a.localeCompare(b, "es"));

  etiquetas.forEach(etiqueta => {
    const opcion = document.createElement("option");
    opcion.value = etiqueta;
    opcion.textContent = etiqueta;

    elementos.filtroEtiqueta.appendChild(opcion);
  });
}

function obtenerDocumentosFiltrados() {
  const texto = elementos.buscador.value.toLowerCase().trim();
  const categoria = elementos.filtroCategoria.value;
  const etiqueta = elementos.filtroEtiqueta.value;
  const soloFavoritos = elementos.soloFavoritos.checked;

  const documentos = estado.documentos.filter(documento => {
    const contenido = [
      documento.titulo,
      documento.descripcion,
      documento.categoria,
      ...(documento.etiquetas || [])
    ]
      .join(" ")
      .toLowerCase();

    const coincideTexto = contenido.includes(texto);
    const coincideCategoria =
      !categoria || documento.categoria === categoria;
    const coincideEtiqueta =
      !etiqueta || documento.etiquetas.includes(etiqueta);
    const coincideFavorito =
      !soloFavoritos || estado.favoritos.includes(documento.id);

    return (
      coincideTexto &&
      coincideCategoria &&
      coincideEtiqueta &&
      coincideFavorito
    );
  });

  return ordenarDocumentos(documentos);
}

function ordenarDocumentos(documentos) {
  const criterio = elementos.ordenar.value;

  return [...documentos].sort((a, b) => {
    if (criterio === "titulo-asc") {
      return a.titulo.localeCompare(b.titulo, "es");
    }

    if (criterio === "titulo-desc") {
      return b.titulo.localeCompare(a.titulo, "es");
    }

    if (criterio === "categoria-asc") {
      return a.categoria.localeCompare(b.categoria, "es");
    }

    if (criterio === "fecha-desc") {
      return new Date(b.fecha) - new Date(a.fecha);
    }

    if (criterio === "fecha-asc") {
      return new Date(a.fecha) - new Date(b.fecha);
    }

    if (criterio === "favoritos") {
      const favoritoA = estado.favoritos.includes(a.id);
      const favoritoB = estado.favoritos.includes(b.id);

      if (favoritoA !== favoritoB) {
        return favoritoB - favoritoA;
      }

      return a.titulo.localeCompare(b.titulo, "es");
    }

    return 0;
  });
}

function renderizar() {
  const documentos = obtenerDocumentosFiltrados();

  elementos.listaDocumentos.innerHTML = "";

  documentos.forEach(documento => {
    elementos.listaDocumentos.appendChild(
      crearFilaDocumento(documento)
    );
  });

  elementos.contador.textContent =
    `${documentos.length} documento${documentos.length === 1 ? "" : "s"}`;

  elementos.estadoVacio.classList.toggle(
    "oculto",
    documentos.length > 0
  );
}

function crearFilaDocumento(documento) {
  const fila = document.createElement("tr");
  const esFavorito = estado.favoritos.includes(documento.id);

  fila.innerHTML = `
    <td>
      <button
        class="boton-favorito ${esFavorito ? "activo" : ""}"
        title="${esFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}"
        aria-label="${esFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}"
      >
        ${esFavorito ? "★" : "☆"}
      </button>
    </td>

    <td>
      <strong>${escaparHTML(documento.titulo)}</strong>
      <small>${escaparHTML(documento.descripcion || "")}</small>
    </td>

    <td>
      ${escaparHTML(documento.categoria)}
    </td>

    <td>
      <div class="etiquetas">
        ${(documento.etiquetas || [])
          .map(etiqueta => `
            <span class="etiqueta">
              ${escaparHTML(etiqueta)}
            </span>
          `)
          .join("")}
      </div>
    </td>

    <td>
      ${formatearFecha(documento.fecha)}
    </td>

    <td>
      <div class="acciones">
        <button class="boton boton-primario boton-previsualizar">
          Ver
        </button>

        <a
          class="boton boton-secundario"
          href="${encodeURI(documento.archivo)}"
          target="_blank"
          rel="noopener"
        >
          Abrir
        </a>

        <a
          class="boton boton-secundario"
          href="${encodeURI(documento.archivo)}"
          download
        >
          Descargar
        </a>
      </div>
    </td>
  `;

  const botonFavorito = fila.querySelector(".boton-favorito");
  const botonPrevisualizar = fila.querySelector(".boton-previsualizar");

  botonFavorito.addEventListener("click", () => {
    cambiarFavorito(documento.id);
  });

  botonPrevisualizar.addEventListener("click", () => {
    abrirModal(documento);
  });

  return fila;
}

function cambiarFavorito(id) {
  if (estado.favoritos.includes(id)) {
    estado.favoritos = estado.favoritos.filter(
      favoritoId => favoritoId !== id
    );
  } else {
    estado.favoritos.push(id);
  }

  localStorage.setItem(
    "favoritos",
    JSON.stringify(estado.favoritos)
  );

  renderizar();
}

function obtenerFavoritos() {
  try {
    return JSON.parse(localStorage.getItem("favoritos")) || [];
  } catch {
    return [];
  }
}

function abrirModal(documento) {
  elementos.tituloPDF.textContent = documento.titulo;
  elementos.visorPDF.src = documento.archivo;
  elementos.modalPDF.classList.remove("oculto");
  document.body.classList.add("sin-scroll");
}

function cerrarModal() {
  elementos.modalPDF.classList.add("oculto");
  elementos.visorPDF.src = "";
  document.body.classList.remove("sin-scroll");
}



function limpiarFiltros() {
  elementos.buscador.value = "";
  elementos.filtroCategoria.value = "";
  elementos.filtroEtiqueta.value = "";
  elementos.ordenar.value = "titulo-asc";
  elementos.soloFavoritos.checked = false;

  renderizar();
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(fecha));
}

function escaparHTML(valor) {
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
