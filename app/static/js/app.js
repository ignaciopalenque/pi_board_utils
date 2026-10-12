const toggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".sidebar");
const toggleMobile = document.getElementById("sidebarToggleMobile")

if (toggle && sidebar) {
    toggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    
}


toggleMobile.addEventListener("click", () => {
        const sidebarMobile = document.querySelector('aside');
        sidebarMobile.classList.replace('open', 'sidebar')
});

    






