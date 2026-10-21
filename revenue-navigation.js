(() => {
    "use strict";

    // Navegação isolada do módulo Receitas. Este arquivo é carregado antes
    // de main.js para que a tela possa abrir mesmo se outro módulo falhar.
    document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const item = target?.closest('.nav-item[data-page="Receitas"]');
        if (!item) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const contentArea = document.querySelector(".content");
        if (!contentArea) {
            console.error("[PRIME Receitas] Contêiner .content não encontrado.");
            window.alert("Não foi possível abrir Receitas: a área principal do PRIME não foi encontrada.");
            return;
        }

        document.querySelectorAll(".nav-item").forEach((navItem) => {
            navItem.classList.toggle("active", navItem.dataset.page === "Receitas");
        });

        document.querySelector("#sidebar")?.classList.remove("open");
        document.querySelector("#menuToggle")?.setAttribute("aria-expanded", "false");

        let page = document.querySelector("#revenuePage");
        if (!page) {
            page = document.createElement("section");
            page.id = "revenuePage";
            page.setAttribute("aria-live", "polite");
            contentArea.appendChild(page);
        }

        Array.from(contentArea.children).forEach((child) => {
            child.hidden = child !== page;
        });
        page.hidden = false;

        const currentPage = document.querySelector("#currentPage");
        if (currentPage) currentPage.textContent = "Receitas";
        window.scrollTo({ top: 0, behavior: "auto" });

        if (!window.PRIMERevenue || typeof window.PRIMERevenue.render !== "function") {
            page.innerHTML = '<section style="padding:24px;color:#E2E8F0"><h1>Receitas</h1><p>O arquivo revenue.js não foi carregado corretamente. Atualize a página com ⌘ + Shift + R.</p></section>';
            console.error("[PRIME Receitas] window.PRIMERevenue.render indisponível.");
            return;
        }

        try {
            window.PRIMERevenue.render(page);
        } catch (error) {
            console.error("[PRIME Receitas] Falha ao renderizar a tela:", error);
            page.innerHTML = '<section style="padding:24px;color:#E2E8F0"><h1>Receitas</h1><p>O módulo encontrou um erro ao abrir. Consulte o Console JavaScript.</p><pre style="white-space:pre-wrap;color:#FCA5A5"></pre></section>';
            page.querySelector("pre").textContent = String(error?.stack || error);
        }
    }, true);
})();
