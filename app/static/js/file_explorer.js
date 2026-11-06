class FileExplorer {
    constructor() {
        this.currentPath = null;
        this.rootPath = null;
        this.history = [];
        this.historyIndex = -1;
        this.selectedItem = null;
        
        this.initElements();
        this.attachEventListeners();
        this.loadRootPath();
    }

    initElements() {
        // Estadísticas
        this.diskTotal = document.getElementById('diskTotal')
        this.diskUsed = document.getElementById('diskUsed')
        this.diskFree = document.getElementById('diskFree')
        // Selector de raíz
        this.rootPathInput = document.getElementById('rootPath');
        this.setRootBtn = document.getElementById('setRootBtn');
        this.currentRootSpan = document.getElementById('currentRoot');

        // Navegación
        this.backBtn = document.getElementById('backBtn');
        this.breadcrumb = document.getElementById('breadcrumb');
        this.createFolderBtn = document.getElementById('createFolderBtn');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');

        // Contenedores
        this.foldersContainer = document.getElementById('foldersContainer');
        this.filesContainer = document.getElementById('filesContainer');
        this.emptyMessage = document.getElementById('emptyMessage');
        this.loadingSpinner = document.getElementById('loadingSpinner');

        // Modales
        this.folderModal = document.getElementById('folderModal');
        this.folderNameInput = document.getElementById('folderNameInput');
        this.createFolderConfirm = document.getElementById('createFolderConfirm');
        this.createFolderCancel = document.getElementById('createFolderCancel');
        this.nameFileUp = document.getElementById('nameFileUp')
        this.renameModal = document.getElementById('renameModal');
        this.renameInput = document.getElementById('renameInput');
        this.renameConfirm = document.getElementById('renameConfirm');
        this.renameCancel = document.getElementById('renameCancel');
        this.editor = document.querySelector('#text-editor');
        this.editorTitle = document.querySelector('#text-editor-title');
        this.editorContent = document.querySelector('#text-editor-content');
        this.editorCancel = document.querySelector('#text-editor-cancel');
        this.editorSave = document.querySelector('#text-editor-save');

        this.currentFilePath = null;



    }

    attachEventListeners() {
        // Selector de raíz
        this.setRootBtn.addEventListener('click', () => this.setRootPath());
        this.rootPathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.setRootPath();
        });

        this.editorCancel.addEventListener('click', () => {
            this.editor.close();
            this.currentFilePath = null;
        });

        this.editorSave.addEventListener('click', () => this.saveTextFile());

        // Navegación
        this.backBtn.addEventListener('click', () => this.navigateBack());

        // Acciones
        this.createFolderBtn.addEventListener('click', () => this.showFolderModal());
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Modal de carpeta
        this.createFolderConfirm.addEventListener('click', () => this.createFolder());
        this.createFolderCancel.addEventListener('click', () => this.hideFolderModal());
        this.folderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createFolder();
        });

        // Modal de renombrar
        this.renameConfirm.addEventListener('click', () => this.confirmRename());
        this.renameCancel.addEventListener('click', () => this.hideRenameModal());
        this.renameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.confirmRename();
        });

        // Soporte para drag & drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                this.handleDroppedFiles(e.dataTransfer.files);
            }
        });
    }

    isEditableTextFile(nameOrPath = '') {
        return /\.(txt|md|json|py|html|css|js|csv|xml|yml|yaml|ini|log)$/i
            .test(nameOrPath);
    }

    async openTextFile(item) {
        try {
            const response = await fetch(
                `/api/files/content?path=${encodeURIComponent(item.path)}`
            );
            if (!response.ok) {
                throw new Error(await this.getResponseError(response));
            }

            const data = await response.json();

            this.currentFilePath = item.path;
            this.editorTitle.textContent = `Editar: ${item.name || item.path}`;
            this.editorContent.value = data.content;
            this.editor.showModal();
        } catch (error) {
            alert(error.message || 'No se pudo abrir el archivo.');
        }
    }

    async saveTextFile() {
        if (!this.currentFilePath) return;

        try {

            const csrfToken = document.querySelector(
            'meta[name="csrf-token"]'
            )?.getAttribute('content');

            if (!csrfToken) {
                this.showError('No se ha encontrado el token CSRF');
                return;
            }



            const response = await fetch('/api/files/content', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json', 'X-CSRFToken': csrfToken 
                },
                body: JSON.stringify({
                    path: this.currentFilePath,
                    content: this.editorContent.value
                })
            });

            if (!response.ok) {
                throw new Error(await this.getResponseError(response));
            }

            this.editor.close();
            this.currentFilePath = null;
        } catch (error) {
            alert(error.message || 'No se pudo guardar el archivo.');
        }
    }

    async getResponseError(response) {
        try {
            const data = await response.json();
            return data.error || `Error ${response.status}`;
        } catch {
            return `Error ${response.status}`;
        }
    }


    async loadRootPath() {
        try {
            const response = await fetch('/api/files/get-root');
            const data = await response.json();
            
            this.rootPath = data.path;
            this.currentPath = data.path;
            this.currentRootSpan.textContent = `Raíz: ${data.path}`;
            this.rootPathInput.value = data.path;
            this.diskTotal.textContent = "Almacenamiento Total : "+data.total+" GB"
            this.diskUsed.textContent = "Almacenamiento Usado : "+data.used+" GB"
            this.diskFree.textContent = "Almacenamiento Disponible : "+data.free+" GB"
            
            this.loadFiles();
        } catch (error) {
            this.showError('Error al cargar la raíz');
        }
    }
    

    async setRootPath() {
        const path = this.rootPathInput.value.trim();

        if (!path) {
            this.showError('Ingresa una ruta válida');
            return;
        }

        this.showLoading(true);

        const csrfToken = document.querySelector(
        'meta[name="csrf-token"]'
        )?.getAttribute('content');

        if (!csrfToken) {
            this.showError('No se ha encontrado el token CSRF');
            return;
        }

        try {
            const response = await fetch('/api/files/set-root', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                body: JSON.stringify({ path })
            });

            const data = await response.json();

            console.log('Error:', data.error);  // ← VER EL MENSAJE DE ERROR EXACTO
            console.log('Data completa:', data);
            console.log('❌ Error:', data.error);  // ← VER ESTO

            if (response.ok) {
                this.rootPath = data.path;
                this.currentPath = data.path;
                this.history = [];
                this.historyIndex = -1;
                this.currentRootSpan.textContent = `Raíz: ${data.path}`;
                this.showSuccess('Raíz establecida correctamente');
                this.loadFiles();
            } else {
                this.showError(data.error || 'Error al establecer la raíz');
            }
        } catch (error) {
            this.showError('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    }

    async loadFiles() {
        if (!this.currentPath) return;

        this.showLoading(true);

        try {
            const response = await fetch(`/api/files/list?path=${encodeURIComponent(this.currentPath)}`);
            const data = await response.json();

            if (response.ok) {
                this.renderItems(data);
                this.updateBreadcrumb();
            } else {
                this.showError(data.error || 'Error al cargar archivos');
            }
        } catch (error) {
            this.showError('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    }

    renderItems(data) {
        this.foldersContainer.innerHTML = '';
        this.filesContainer.innerHTML = '';

        const isEmpty = data.folders.length === 0 && data.files.length === 0;
        this.emptyMessage.style.display = isEmpty ? 'block' : 'none';

        // Renderizar carpetas
        data.folders.forEach(folder => {
            const element = this.createItemElement(folder, 'folder');
            this.foldersContainer.appendChild(element);
        });

        // Renderizar archivos
        data.files.forEach(file => {
            const element = this.createItemElement(file, 'file');
            this.filesContainer.appendChild(element);
        });
    }

    createItemElement(item, type) {
        const div = document.createElement('div');
        div.className = 'item';
        div.dataset.path = item.path;
        div.dataset.type = type;

        const icon = type === 'folder' ? '📁' : this.getFileIcon(item.name);
        const info = type === 'folder' 
            ? new Date(item.modified * 1000).toLocaleDateString()
            : `${this.formatFileSize(item.size)} • ${new Date(item.modified * 1000).toLocaleDateString()}`;

        div.innerHTML = `
            <div class="item-icon">${icon}</div>
            <div class="item-name" title="${item.name}">${item.name}</div>
            <div class="item-info">${info}</div>
            <div class="item-menu">
                <button class="item-menu-btn" title="Opciones">⋮</button>
            </div>
        `;

        // Eventos
        if (type === 'folder') {
            div.addEventListener('dblclick', () => this.navigateToFolder(item.path));
        } else {
            div.addEventListener('dblclick', () => this.downloadFile(item.path));
        }

        const menuBtn = div.querySelector('.item-menu-btn');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenu(e, item, type);
        });

        return div;
    }

  
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            // Documentos
            'pdf': '📄',
            'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊',
            'ppt': '📈', 'pptx': '📈',
            'txt': '📄',
            
            // Imágenes
            'jpg': '🖼️', 'jpeg': '🖼️',
            'png': '🖼️', 'gif': '🖼️',
            'svg': '🖼️', 'ico': '🖼️',
            
            // Vídeos
            'mp4': '🎥', 'avi': '🎥',
            'mov': '🎥', 'mkv': '🎥',
            'flv': '🎥', 'wmv': '🎥',
            
            // Audio
            'mp3': '🎵', 'wav': '🎵',
            'flac': '🎵', 'aac': '🎵',
            'm4a': '🎵',
            
            // Código
            'py': '🐍', 'js': '🔷',
            'html': '🌐', 'css': '🎨',
            'json': '⚙️', 'xml': '📋',
            'php': '🐘', 'java': '☕',
            'cpp': '⚡', 'c': '⚡',
            'sh': '💻', 'bash': '💻',
            
            // Comprimidos
            'zip': '📦', 'rar': '📦',
            'tar': '📦', 'gz': '📦',
            '7z': '📦'
        };
        
        return icons[ext] || '📎';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    updateBreadcrumb() {
        this.breadcrumb.innerHTML = '';

        const parts = this.currentPath.split(this.rootPath)[1] || '';
        const pathParts = this.rootPath.split('/').filter(p => p);

        // Botón de raíz
        const rootBtn = document.createElement('span');
        rootBtn.className = 'breadcrumb-item';
        rootBtn.textContent = '📁 Raíz';
        rootBtn.addEventListener('click', () => {
            this.currentPath = this.rootPath;
            this.loadFiles();
        });
        this.breadcrumb.appendChild(rootBtn);

        if (parts) {
            const subparts = parts.split('/').filter(p => p);
            let currentPath = this.rootPath;

            subparts.forEach((part, index) => {
                const sep = document.createElement('span');
                sep.className = 'breadcrumb-separator';
                sep.textContent = '/';
                this.breadcrumb.appendChild(sep);

                currentPath += '/' + part;
                const btn = document.createElement('span');
                btn.className = 'breadcrumb-item';
                btn.textContent = part;
                btn.dataset.path = currentPath;

                btn.addEventListener('click', () => {
                    this.currentPath = currentPath;
                    this.loadFiles();
                });

                this.breadcrumb.appendChild(btn);
            });
        }
    }

    navigateToFolder(path) {
        // Agregar al historial
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(this.currentPath);
        this.historyIndex++;

        this.currentPath = path;
        this.loadFiles();
    }

    navigateBack() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.currentPath = this.history[this.historyIndex];
            this.loadFiles();
        }
    }

    showFolderModal() {
        this.folderNameInput.value = '';
        this.folderNameInput.focus();
        this.folderModal.style.display = 'flex';
    }

    hideFolderModal() {
        this.folderModal.style.display = 'none';
    }

    async createFolder() {
        const name = this.folderNameInput.value.trim();

        if (!name) {
            this.showError('Ingresa un nombre válido');
            return;
        }

        this.showLoading(true);

        const csrfToken = document.querySelector(
        'meta[name="csrf-token"]'
        )?.getAttribute('content');

        try {
            const currentPath = this.currentPath || '/';
            console.log(currentPath)
            const url = `/api/files/create-folder?path=${encodeURIComponent(currentPath)}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                body: JSON.stringify({ name })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess(`Carpeta "${name}" creada`);
                this.hideFolderModal();
                this.loadFiles();
            } else {
                this.showError(data.error || 'Error al crear la carpeta');
            }
        } catch (error) {
            this.showError('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    }

    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        this.handleDroppedFiles(files);
        this.fileInput.value = ''; // Limpiar input
    }

    async handleDroppedFiles(files) {
        if (files.length === 0) return;

        this.showLoading(true);
        let successCount = 0;
        let errorCount = 0;

        for (const file of files) {
            try {
                nameFileUp.textContent = "Subiendo Archivo : "+ successCount + " de "+ files.length + " : "   +file.name
                await this.uploadFile(file);
                successCount++;
                nameFileUp.textContent = "Último Archivo Subido : "+file.name

            } catch (error) {
                errorCount++;
                console.error(`Error al subir ${file.name}:`, error);
            }
        }

        this.showLoading(false);

        if (errorCount === 0) {
            this.showSuccess(`${successCount} archivo(s) subido(s) correctamente`);
        } else {
            this.showError(`Se subieron ${successCount} archivo(s), ${errorCount} error(es)`);
        }

        this.loadFiles();
    }

    async uploadFile(file) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        // Obtener el token CSRF desde el HTML
        const csrfToken = document.querySelector(
            'meta[name="csrf-token"]'
        )?.getAttribute('content');

        if (!csrfToken) {
            reject(new Error('No se ha encontrado el token CSRF'));
            return;
        }

        const xhr = new XMLHttpRequest();

        xhr.addEventListener('load', () => {
            let data;

            try {
                data = JSON.parse(xhr.responseText);
            } catch {
                reject(new Error(
                    `Respuesta no válida del servidor (HTTP ${xhr.status})`
                ));
                return;
            }

            if (xhr.status === 200 || xhr.status === 201) {
                resolve(data);
            } else {
                reject(new Error(
                    data.error || `Error HTTP ${xhr.status}`
                ));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Error de conexión durante la subida'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Subida cancelada'));
        });

        xhr.open(
            'POST',
            `/api/files/upload?path=${encodeURIComponent(this.currentPath)}`
        );

        // Enviar el token CSRF
        xhr.setRequestHeader('X-CSRFToken', csrfToken);

        // No establecer Content-Type manualmente:
        // XMLHttpRequest lo genera automáticamente para FormData.
        xhr.send(formData);
    });
}

    async downloadFile(path) {
        try {
            const response = await fetch(`/api/files/download?file=${encodeURIComponent(path)}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const filename = path.split('/').pop();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                this.showError('Error al descargar el archivo');
            }
        } catch (error) {
            this.showError('Error de conexión');
        }
    }

showContextMenu(event, item, type) {
    event.preventDefault();

    // Remover menú anterior si existe
    document.querySelector('.context-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';

    // Posición provisional para poder medir el menú
    menu.style.left = '0px';
    menu.style.top = '0px';

    const options = [
        {
            label: type === 'folder' ? '📂 Abrir' : '💾 Descargar',
            action: () => {
                if (type === 'folder') {
                    this.navigateToFolder(item.path);
                } else {
                    this.downloadFile(item.path);
                }
            }
        },
        ...(type === 'file' && this.isEditableTextFile(item.name || item.path)
            ? [{
                label: '📝 Editar',
                action: () => this.openTextFile(item)
            }]
            : []),
        {
            label: '✏️ Renombrar',
            action: () => this.showRenameModal(item)
        },
        {
            label: '🗑️ Eliminar',
            action: () => this.deleteItemConfirm(item.path),
            danger: true
        }
    ];

    options.forEach(option => {
        const menuItem = document.createElement('div');
        menuItem.className =
            'context-menu-item' + (option.danger ? ' danger' : '');
        menuItem.textContent = option.label;

        menuItem.addEventListener('click', () => {
            menu.remove();
            option.action();
        });

        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Ajustar la posición para que el menú no salga de la ventana
    const margin = 8;
    const rect = menu.getBoundingClientRect();

    const left = Math.max(
        margin,
        Math.min(event.clientX, window.innerWidth - rect.width - margin)
    );

    const top = Math.max(
        margin,
        Math.min(event.clientY, window.innerHeight - rect.height - margin)
    );

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Cerrar al hacer clic fuera
    const closeOnOutsideClick = e => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeOnOutsideClick);
        }
    };

    // Esperar al siguiente ciclo para que el clic que abrió el menú
    // no lo cierre inmediatamente.
    setTimeout(() => {
        document.addEventListener('click', closeOnOutsideClick);
    }, 0);
}


    showRenameModal(item) {
        this.selectedItem = item;
        this.renameInput.value = item.name;
        this.renameInput.focus();
        this.renameInput.select();
        this.renameModal.style.display = 'flex';
    }

    hideRenameModal() {
        this.renameModal.style.display = 'none';
        this.selectedItem = null;
    }

    async confirmRename() {
        const newName = this.renameInput.value.trim();

        if (!newName || !this.selectedItem) {
            this.showError('Nombre inválido');
            return;
        }

        if (newName === this.selectedItem.name) {
            this.hideRenameModal();
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/files/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldPath: this.selectedItem.path,
                    newName: newName
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess('Archivo renombrado');
                this.hideRenameModal();
                this.loadFiles();
            } else {
                this.showError(data.error || 'Error al renombrar');
            }
        } catch (error) {
            this.showError('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    }

    deleteItemConfirm(path){

         Swal.fire({
                title: "Eliminar archivo",
                text: `¿Estás seguro de que deseas eliminar este elemento "${path}"?`,
                icon: "question",
                showCancelButton: true,
                showCancelButton: true,
                focusConfirm: true,
                theme:'dark',
                confirmButtonColor: "#39ff88",
                cancelButtonColor: "#a20e22",
                confirmButtonText: `Aceptar`,
                cancelButtonText: "Cancelar"
                }).then((result) => {

                    if (result.isDismissed) {
                        console.log("Salir del metodo")
                    return;
                   }else{

                    this.deleteItem(path); 

                   }
                });


    }

    async deleteItem(path) {
      

        this.showLoading(true);

        const csrfToken = document.querySelector(
        'meta[name="csrf-token"]'
        )?.getAttribute('content');

        try {
            const response = await fetch('/api/files/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                body: JSON.stringify({ path })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess('Elemento eliminado');
                this.loadFiles();
            } else {
                this.showError(data.error || 'Error al eliminar');
            }
        } catch (error) {
            this.showError('Error de conexión');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        this.loadingSpinner.style.display = show ? 'flex' : 'none';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 3000;
            animation: slideIn 0.3s ease-out;
            font-size: 14px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new FileExplorer();
});

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function showContextMenu(menu, event) {
    menu.style.display = 'block';
    menu.style.left = '0px';
    menu.style.top = '0px';

    const margin = 8;
    const rect = menu.getBoundingClientRect();

    const left = Math.max(
        margin,
        Math.min(event.clientX, window.innerWidth - rect.width - margin)
    );

    const top = Math.max(
        margin,
        Math.min(event.clientY, window.innerHeight - rect.height - margin)
    );

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}
