"use strict";

/*
 * PRIME Developer Area prototype.
 * Registries use localStorage only; this is NOT secure multi-user access control.
 * Do not use this as production tenant/authentication security until a backend
 * with authenticated developer permissions is connected.
 */
(() => {
    const COMPANIES_KEY = "primeDeveloperCompaniesV1";
    const USERS_KEY = "primeDeveloperUsersV1";
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    let activeTab = "companies";
    const content = $(".content");
    const originalContent = content ? [...content.children] : [];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, c => ({
            "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
        })[c]);
    }
    function read(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.error("PRIME: erro ao ler cadastro do desenvolvedor.", error);
            return [];
        }
    }
    function save(key, rows) {
        try {
            localStorage.setItem(key, JSON.stringify(rows));
            return true;
        } catch (error) {
            console.error("PRIME: erro ao salvar cadastro do desenvolvedor.", error);
            notify("Não foi possível salvar. Verifique o armazenamento do navegador.");
            return false;
        }
    }
    function notify(message) {
        const toast = $("#toast");
        if (toast) {
            toast.textContent = message;
            toast.hidden = false;
            window.setTimeout(() => { toast.hidden = true; }, 3200);
        } else window.alert(message);
    }
    function render() {
        const target = $(".content");
        if (!target) return;
        const companies = read(COMPANIES_KEY);
        const users = read(USERS_KEY);
        target.innerHTML = `
          <section class="prime-developer">
            <header class="settings-header">
              <div><div class="eyebrow">PRIME / CONTROLE CENTRAL</div>
                <h1>Área do desenvolvedor<span class="blue-period">.</span></h1>
                <p>Cadastro central de empresas clientes e usuários do PRIME.</p>
              </div>
            </header>
            <div class="developer-warning" role="note">
              <strong>Importante: modo local de desenvolvimento.</strong>
              <p>Os cadastros abaixo ficam apenas neste navegador. Como o projeto ainda não aplica autenticação e permissões no backend, esta tela não impede tecnicamente que outra pessoa com acesso à aplicação a utilize. Antes de cadastrar clientes reais, conecte esta área a um backend com acesso exclusivo do desenvolvedor.</p>
            </div>
            <div class="developer-tabs">
              <button type="button" data-dev-tab="companies" class="${activeTab==="companies"?"active":""}">Empresas <span>${companies.length}</span></button>
              <button type="button" data-dev-tab="users" class="${activeTab==="users"?"active":""}">Usuários <span>${users.length}</span></button>
            </div>
            ${activeTab==="companies" ? companyPanel(companies) : userPanel(users,companies)}
          </section>`;
        bind();
        if (window.lucide) window.lucide.createIcons();
    }
    function companyPanel(companies) {
        return `
          <div class="developer-grid">
            <section class="settings-panel">
              <div class="settings-section-heading"><h2>Cadastrar empresa</h2><p>Registre uma empresa cliente para controle administrativo.</p></div>
              <form id="devCompanyForm">
                <div class="settings-fields">
                  <label class="settings-field"><span>Razão social *</span><input name="legalName" required maxlength="160"></label>
                  <label class="settings-field"><span>Nome fantasia</span><input name="tradeName" maxlength="160"></label>
                  <label class="settings-field"><span>CNPJ</span><input name="cnpj" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00"></label>
                  <label class="settings-field"><span>E-mail administrativo</span><input name="email" type="email" maxlength="180"></label>
                  <label class="settings-field"><span>Responsável</span><input name="contact" maxlength="120"></label>
                  <label class="settings-field"><span>Status</span><select name="status"><option value="active">Ativa</option><option value="pending">Pendente</option><option value="inactive">Inativa</option></select></label>
                </div>
                <div class="settings-actions"><button class="button-primary" type="submit">Cadastrar empresa</button></div>
              </form>
            </section>
            <section class="settings-panel developer-list-panel">
              <div class="settings-section-heading"><h2>Empresas cadastradas</h2><p>${companies.length} registro(s)</p></div>
              ${companies.length ? `<div class="developer-record-list">${companies.map(c=>`
                <article class="developer-record">
                  <div><strong>${escapeHTML(c.tradeName || c.legalName)}</strong><small>${escapeHTML(c.legalName)}${c.cnpj ? " · "+escapeHTML(c.cnpj) : ""}</small><small>${escapeHTML(c.email || "Sem e-mail cadastrado")}</small></div>
                  <span class="developer-status ${escapeHTML(c.status)}">${c.status==="active"?"Ativa":c.status==="pending"?"Pendente":"Inativa"}</span>
                  <button type="button" class="developer-delete" data-delete-company="${escapeHTML(c.id)}" aria-label="Excluir empresa" title="Excluir empresa"><i data-lucide="trash-2"></i></button>
                </article>`).join("")}</div>` : '<div class="settings-empty">Nenhuma empresa cadastrada ainda.</div>'}
            </section>
          </div>`;
    }
    function userPanel(users, companies) {
        return `
          <div class="developer-grid">
            <section class="settings-panel">
              <div class="settings-section-heading"><h2>Cadastrar usuário</h2><p>Registre o usuário e vincule-o a uma empresa. A criação de conta e autenticação real exige backend.</p></div>
              <form id="devUserForm">
                <div class="settings-fields">
                  <label class="settings-field"><span>Nome completo *</span><input name="name" required maxlength="160"></label>
                  <label class="settings-field"><span>E-mail de acesso *</span><input name="email" type="email" required maxlength="180"></label>
                  <label class="settings-field"><span>Empresa</span><select name="companyId"><option value="">Sem empresa vinculada</option>${companies.map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(c.tradeName || c.legalName)}</option>`).join("")}</select></label>
                  <label class="settings-field"><span>Perfil pretendido</span><select name="role"><option value="admin">Administrador da empresa</option><option value="finance">Financeiro</option><option value="viewer">Somente leitura</option></select></label>
                  <label class="settings-field"><span>Status</span><select name="status"><option value="pending">Pendente de ativação</option><option value="active">Ativo (registro local)</option><option value="inactive">Inativo</option></select></label>
                </div>
                <div class="settings-actions"><button class="button-primary" type="submit">Cadastrar usuário</button></div>
              </form>
              <p class="settings-local-note">Não cadastre senhas aqui. Este formulário registra metadados localmente, não cria credenciais nem concede permissões de segurança.</p>
            </section>
            <section class="settings-panel developer-list-panel">
              <div class="settings-section-heading"><h2>Usuários registrados</h2><p>${users.length} registro(s)</p></div>
              ${users.length ? `<div class="developer-record-list">${users.map(u=>{
                const company=companies.find(c=>c.id===u.companyId);
                return `<article class="developer-record">
                  <div><strong>${escapeHTML(u.name)}</strong><small>${escapeHTML(u.email)}</small><small>${escapeHTML(company ? (company.tradeName || company.legalName) : "Sem empresa vinculada")} · ${escapeHTML(({admin:"Administrador",finance:"Financeiro",viewer:"Somente leitura"})[u.role] || u.role)}</small></div>
                  <span class="developer-status ${escapeHTML(u.status)}">${u.status==="active"?"Ativo":u.status==="pending"?"Pendente":"Inativo"}</span>
                  <button type="button" class="developer-delete" data-delete-user="${escapeHTML(u.id)}" aria-label="Excluir usuário" title="Excluir usuário"><i data-lucide="trash-2"></i></button>
                </article>`;
              }).join("")}</div>` : '<div class="settings-empty">Nenhum usuário registrado ainda.</div>'}
            </section>
          </div>`;
    }
    function bind() {
        $$("[data-dev-tab]").forEach(button => button.addEventListener("click", () => {
            activeTab = button.dataset.devTab; render();
        }));
        $("#devCompanyForm")?.addEventListener("submit", event => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            const legalName = String(fd.get("legalName")||"").trim();
            const cnpj = String(fd.get("cnpj")||"").trim();
            const email = String(fd.get("email")||"").trim();
            if (!legalName) return notify("Informe a razão social.");
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return notify("Informe um e-mail válido.");
            const rows = read(COMPANIES_KEY);
            if (cnpj && rows.some(c => c.cnpj && c.cnpj.replace(/\D/g,"") === cnpj.replace(/\D/g,""))) return notify("Já existe uma empresa com este CNPJ.");
            rows.unshift({id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), legalName, tradeName:String(fd.get("tradeName")||"").trim(), cnpj, email, contact:String(fd.get("contact")||"").trim(), status:String(fd.get("status")||"active"), createdAt:new Date().toISOString()});
            if (save(COMPANIES_KEY, rows)) { notify("Empresa cadastrada neste navegador."); render(); }
        });
        $("#devUserForm")?.addEventListener("submit", event => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget), name=String(fd.get("name")||"").trim(), email=String(fd.get("email")||"").trim().toLowerCase();
            const rows=read(USERS_KEY);
            if (!name || !email) return notify("Informe nome e e-mail.");
            if (rows.some(u=>u.email.toLowerCase()===email)) return notify("Este e-mail já está registrado.");
            rows.unshift({id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, email, companyId:String(fd.get("companyId")||""), role:String(fd.get("role")||"viewer"), status:String(fd.get("status")||"pending"), createdAt:new Date().toISOString()});
            if (save(USERS_KEY,rows)) { notify("Registro de usuário criado localmente; nenhuma conta de acesso foi criada."); render(); }
        });
        $$("[data-delete-company]").forEach(button => button.addEventListener("click", () => {
            const id=button.dataset.deleteCompany, users=read(USERS_KEY);
            if (users.some(u=>u.companyId===id)) return notify("Não é possível excluir: há usuários vinculados. Desvincule-os primeiro.");
            if (!window.confirm("Excluir este cadastro de empresa deste navegador?")) return;
            if (save(COMPANIES_KEY,read(COMPANIES_KEY).filter(c=>c.id!==id))) render();
        }));
        $$("[data-delete-user]").forEach(button => button.addEventListener("click", () => {
            if (!window.confirm("Excluir este registro de usuário deste navegador?")) return;
            if (save(USERS_KEY,read(USERS_KEY).filter(u=>u.id!==button.dataset.deleteUser))) render();
        }));
    }
    function open() {
        const target=$(".content"); if(!target) return;
        render();
        if(location.hash!=="#developer") history.replaceState(null,"","#developer");
    }
    function restore() {
        const target=$(".content"); if(!target) return;
        target.replaceChildren(...originalContent);
        if(location.hash==="#developer") history.replaceState(null,"","#dashboard");
    }
    document.addEventListener("click", event => {
        const item=event.target.closest('.nav-item[data-page="Área do desenvolvedor"], .nav-item[href="#developer"]');
        if(!item) return;
        event.preventDefault(); event.stopImmediatePropagation();
        $$(".nav-item").forEach(nav=>nav.classList.toggle("active",nav===item));
        if($("#currentPage")) $("#currentPage").textContent="Área do desenvolvedor";
        open();
    }, true);
    document.addEventListener("click", event => {
        const item=event.target.closest('.nav-item[data-page="Dashboard"], .nav-item[href="#dashboard"]');
        if(!item || !$(".prime-developer")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        $$(".nav-item").forEach(nav=>nav.classList.toggle("active",nav===item));
        if($("#currentPage")) $("#currentPage").textContent="Dashboard";
        restore();
    }, true);
    window.addEventListener("hashchange",()=>{if(location.hash==="#developer")open();});
})();
