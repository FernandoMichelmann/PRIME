(function () {
    "use strict";
    const KEY = "primeSystemUsersV1";
    const MODULES = [
        ["dashboard", "Dashboard"], ["expenses", "Despesas"], ["revenue", "Receitas"],
        ["cashflow", "Fluxo de caixa"], ["banks", "Bancos e cartões"], ["payables", "Contas a pagar"],
        ["receivables", "Contas a receber"], ["reports", "Relatórios"], ["registrations", "Cadastros"],
        ["payroll", "Folha de pagamento"], ["settings", "Configurações"]
    ];
    const ACTIONS = [["view", "Visualizar"], ["create", "Cadastrar"], ["edit", "Editar"], ["delete", "Excluir"], ["approve", "Aprovar"]];
    const ROLES = {
        "Administrador": ["view", "create", "edit", "delete", "approve"],
        "Gestor": ["view", "create", "edit", "approve"],
        "Financeiro": ["view", "create", "edit"],
        "Operacional": ["view", "create"],
        "Consulta": ["view"]
    };
    let users = load();
    let search = "";

    function permissionsFor(role) {
        const allowed = ROLES[role] || ROLES.Consulta;
        const result = {};
        MODULES.forEach(function (m) {
            result[m[0]] = {};
            ACTIONS.forEach(function (a) { result[m[0]][a[0]] = allowed.includes(a[0]); });
        });
        return result;
    }
    function defaultAdmin() {
        return {
            id: "prime-admin-default", fullName: "Administrador principal", cpf: "", email: "", phone: "",
            username: "admin", department: "Administração", position: "Administrador do sistema",
            role: "Administrador", admissionDate: "", status: "Ativo",
            notes: "Perfil inicial do sistema.", permissions: permissionsFor("Administrador"),
            systemDefault: true, createdAt: new Date().toISOString()
        };
    }
    function load() {
        try {
            const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
            return Array.isArray(parsed) && parsed.length ? parsed : [defaultAdmin()];
        } catch (error) { return [defaultAdmin()]; }
    }
    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(users));
            window.dispatchEvent(new CustomEvent("prime:users-updated"));
            return true;
        } catch (error) { return false; }
    }
    function esc(v) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function initials(name) {
        return String(name || "U").trim().split(/\s+/).slice(0, 2).map(function (s) { return s[0] || ""; }).join("").toUpperCase();
    }
    function hasPermission(user, moduleId, actionId) {
        return Boolean(user && user.permissions && user.permissions[moduleId] && user.permissions[moduleId][actionId]);
    }
    function iconRefresh() { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); }
    function notice(container, message) {
        const old = container.querySelector(".users-inline-notice");
        if (old) old.remove();
        const el = document.createElement("div");
        el.className = "users-inline-notice";
        el.setAttribute("role", "status");
        el.textContent = message;
        container.querySelector(".users-module")?.prepend(el);
    }
    function render(container) {
        if (!container) return;
        users = load();
        const filtered = users.filter(function (u) {
            return [u.fullName, u.username, u.email, u.department, u.position, u.role].join(" ").toLowerCase().includes(search.toLowerCase());
        });
        const active = users.filter(function (u) { return u.status === "Ativo"; }).length;
        const admins = users.filter(function (u) { return u.status === "Ativo" && u.role === "Administrador"; }).length;
        const rows = filtered.map(function (u) {
            const status = u.status === "Ativo" ? "is-active" : "is-inactive";
            return '<tr><td><div class="users-person-cell"><span class="users-avatar">' + esc(initials(u.fullName)) +
                '</span><span><strong>' + esc(u.fullName) + '</strong><small>' + esc(u.email || "E-mail não informado") +
                '</small></span></div></td><td><code>' + esc(u.username) + '</code></td><td><strong>' + esc(u.position || "—") +
                '</strong><small class="users-secondary">' + esc(u.department || "—") + '</small></td><td><span class="users-role-pill">' +
                esc(u.role) + '</span></td><td><span class="users-status ' + status + '">' + esc(u.status) +
                '</span></td><td><div class="users-row-actions"><button type="button" class="icon-button" title="Editar usuário" data-users-action="edit" data-user-id="' +
                esc(u.id) + '"><i data-lucide="pencil"></i></button><button type="button" class="icon-button" title="Ativar/desativar" data-users-action="toggle" data-user-id="' +
                esc(u.id) + '"><i data-lucide="' + (u.status === "Ativo" ? "user-round-x" : "user-round-check") +
                '"></i></button><button type="button" class="icon-button users-delete-button" title="Excluir usuário" data-users-action="delete" data-user-id="' +
                esc(u.id) + '"' + (u.systemDefault ? " disabled" : "") + '><i data-lucide="trash-2"></i></button></div></td></tr>';
        }).join("");
        container.innerHTML = '<section class="users-module" aria-label="Cadastro de usuários">' +
            '<header class="users-page-header"><div><div class="eyebrow">ADMINISTRAÇÃO DO SISTEMA</div><h1>Usuários e permissões<span class="blue-period">.</span></h1>' +
            '<p>Cadastre as pessoas que vão operar o PRIME e defina as áreas e ações permitidas para cada perfil.</p></div>' +
            '<button type="button" class="button-primary" data-users-action="new"><i data-lucide="user-plus"></i> Novo usuário</button></header>' +
            '<div class="users-security-notice"><i data-lucide="shield-alert"></i><div><strong>Cadastro local — versão inicial</strong>' +
            '<p>Os dados ficam neste navegador. As permissões são configuráveis, mas ainda não bloqueiam o acesso de verdade. Autenticação segura, validação no servidor e sincronização entre computadores ainda precisam ser implementadas. Não armazene senhas nem dados sensíveis reais nesta versão.</p></div></div>' +
            '<div class="users-stats-grid"><article class="users-stat-card"><span>Usuários cadastrados</span><strong>' + users.length +
            '</strong><small>Perfis neste navegador</small></article><article class="users-stat-card"><span>Usuários ativos</span><strong>' + active +
            '</strong><small>Com status ativo</small></article><article class="users-stat-card"><span>Administradores ativos</span><strong>' + admins +
            '</strong><small>Perfis administrativos</small></article></div>' +
            '<section class="users-panel"><div class="users-panel-heading"><div><h2>Pessoas com acesso ao PRIME</h2><p>Consulte, edite, desative ou cadastre operadores.</p></div>' +
            '<label class="users-search"><i data-lucide="search"></i><input type="search" data-users-search placeholder="Buscar por nome, login ou função..." value="' + esc(search) + '"></label></div>' +
            '<div class="users-table-wrap"><table class="users-table"><thead><tr><th>Usuário</th><th>Login</th><th>Departamento / função</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="6"><div class="users-empty-state"><i data-lucide="users"></i><strong>Nenhum usuário encontrado</strong></div></td></tr>') +
            '</tbody></table></div></section><section class="users-form-panel" data-users-form-panel hidden></section></section>';
        container.querySelector("[data-users-search]")?.addEventListener("input", function (event) {
            search = event.target.value;
            const start = event.target.selectionStart;
            render(container);
            const next = container.querySelector("[data-users-search]");
            next?.focus();
            next?.setSelectionRange(start, start);
        });
        container.querySelectorAll("[data-users-action]").forEach(function (button) {
            button.addEventListener("click", function () {
                const action = button.dataset.usersAction;
                const user = users.find(function (u) { return u.id === button.dataset.userId; });
                if (action === "new") { openForm(container, null); return; }
                if (action === "edit" && user) { openForm(container, user); return; }
                if (action === "cancel") { const panel = container.querySelector("[data-users-form-panel]"); panel.hidden = true; panel.innerHTML = ""; return; }
                if (action === "toggle" && user) {
                    if (user.systemDefault && user.status === "Ativo") { notice(container, "O administrador principal não pode ser desativado nesta versão."); return; }
                    if (user.role === "Administrador" && user.status === "Ativo" && users.filter(function (u) { return u.role === "Administrador" && u.status === "Ativo"; }).length <= 1) {
                        notice(container, "Mantenha pelo menos um administrador ativo."); return;
                    }
                    user.status = user.status === "Ativo" ? "Inativo" : "Ativo";
                    if (save()) { render(container); notice(container, "Status do usuário atualizado."); }
                    return;
                }
                if (action === "delete" && user) {
                    if (user.systemDefault) { notice(container, "O administrador principal não pode ser excluído."); return; }
                    if (user.role === "Administrador" && user.status === "Ativo" && users.filter(function (u) { return u.role === "Administrador" && u.status === "Ativo"; }).length <= 1) {
                        notice(container, "Não é possível excluir o último administrador ativo."); return;
                    }
                    if (!window.confirm("Excluir o cadastro de " + user.fullName + "?")) return;
                    users = users.filter(function (u) { return u.id !== user.id; });
                    if (save()) { render(container); notice(container, "Cadastro excluído."); }
                }
            });
        });
        iconRefresh();
    }
    function openForm(container, user) {
        const panel = container.querySelector("[data-users-form-panel]");
        const u = user || {};
        const selectedRole = u.role || "Consulta";
        const permissionRows = MODULES.map(function (m) {
            return '<tr><td>' + m[1] + '</td>' + ACTIONS.map(function (a) {
                return '<td><input type="checkbox" name="perm-' + m[0] + '-' + a[0] + '" aria-label="' + m[1] + ': ' + a[1] + '"' +
                    (hasPermission(u, m[0], a[0]) ? " checked" : "") + '></td>';
            }).join("") + '</tr>';
        }).join("");
        const roleOptions = Object.keys(ROLES).map(function (role) {
            return '<option value="' + role + '"' + (role === selectedRole ? " selected" : "") + '>' + role + '</option>';
        }).join("");
        function field(label, name, type, required, placeholder, wide) {
            return '<label class="users-field' + (wide ? " users-field-wide" : "") + '">' + label + (required ? " *" : "") +
                '<input name="' + name + '" type="' + (type || "text") + '"' + (required ? " required" : "") +
                ' maxlength="' + (name === "notes" ? "500" : "160") + '" value="' + esc(u[name]) + '" placeholder="' + (placeholder || "") + '"></label>';
        }
        panel.innerHTML = '<form class="users-form" data-users-form><div class="users-form-header"><div><div class="eyebrow">' +
            (user ? "ATUALIZAÇÃO CADASTRAL" : "NOVO CADASTRO") + '</div><h2>' + (user ? "Editar usuário" : "Cadastrar usuário") +
            '</h2><p>Dados de identificação, vínculo profissional e permissões de acesso.</p></div><button type="button" class="icon-button" data-users-action="cancel" aria-label="Fechar"><i data-lucide="x"></i></button></div>' +
            '<input type="hidden" name="id" value="' + esc(u.id) + '">' +
            '<div class="users-form-section-title"><i data-lucide="contact-round"></i> Dados pessoais e profissionais</div><div class="users-fields-grid">' +
            field("Nome completo", "fullName", "text", true, "Nome e sobrenome", true) +
            field("CPF", "cpf", "text", false, "000.000.000-00") +
            field("E-mail corporativo", "email", "email", false, "nome@empresa.com.br") +
            field("Telefone", "phone", "tel", false, "(00) 00000-0000") +
            field("Data de entrada", "admissionDate", "date", false, "") +
            field("Departamento", "department", "text", false, "Ex.: Financeiro") +
            field("Cargo / função", "position", "text", false, "Ex.: Assistente financeiro") +
            '</div><div class="users-form-section-title"><i data-lucide="key-round"></i> Acesso ao sistema</div><div class="users-fields-grid">' +
            field("Nome de usuário / login", "username", "text", true, "ex.: joao.silva") +
            '<label class="users-field">Perfil de acesso *<select name="role" required>' + roleOptions + '</select></label>' +
            '<label class="users-field">Situação<select name="status"><option value="Ativo"' + ((u.status || "Ativo") === "Ativo" ? " selected" : "") + '>Ativo</option><option value="Inativo"' + (u.status === "Inativo" ? " selected" : "") + '>Inativo</option></select></label>' +
            '<label class="users-field users-field-wide">Observações internas<textarea name="notes" rows="3" maxlength="500" placeholder="Informações administrativas não sensíveis">' + esc(u.notes) + '</textarea></label></div>' +
            '<div class="users-permissions-header"><div><div class="users-form-section-title"><i data-lucide="shield-check"></i> Permissões por módulo</div><p>Personalize o que este perfil poderá fazer em cada área.</p></div><button type="button" class="button-secondary" data-users-action="apply-role">Aplicar padrão do perfil</button></div>' +
            '<div class="users-permissions-table-wrap"><table class="users-permissions-table"><thead><tr><th>Módulo</th>' + ACTIONS.map(function (a) { return '<th>' + a[1] + '</th>'; }).join("") + '</tr></thead><tbody>' + permissionRows + '</tbody></table></div>' +
            '<div class="users-form-footer"><span class="users-form-hint"><i data-lucide="info"></i> Não cadastre senhas aqui. A autenticação segura será conectada ao servidor em uma etapa própria.</span><div><button type="button" class="button-secondary" data-users-action="cancel">Cancelar</button><button type="submit" class="button-primary"><i data-lucide="save"></i> Salvar usuário</button></div></div></form>';
        panel.hidden = false;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        const form = panel.querySelector("[data-users-form]");
        form.querySelector('[name="role"]').addEventListener("change", function () {
            const p = permissionsFor(this.value);
            MODULES.forEach(function (m) { ACTIONS.forEach(function (a) {
                const cb = form.elements["perm-" + m[0] + "-" + a[0]];
                if (cb) cb.checked = p[m[0]][a[0]];
            }); });
        });
        panel.querySelectorAll('[data-users-action="cancel"]').forEach(function (b) {
            b.addEventListener("click", function () { panel.hidden = true; panel.innerHTML = ""; });
        });
        panel.querySelector('[data-users-action="apply-role"]').addEventListener("click", function () {
            const p = permissionsFor(form.elements.role.value);
            MODULES.forEach(function (m) { ACTIONS.forEach(function (a) {
                const cb = form.elements["perm-" + m[0] + "-" + a[0]];
                if (cb) cb.checked = p[m[0]][a[0]];
            }); });
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            const fd = new FormData(form);
            const id = String(fd.get("id") || ("user-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7)));
            const fullName = String(fd.get("fullName") || "").trim();
            const username = String(fd.get("username") || "").trim().toLowerCase();
            if (!fullName || username.length < 3) { notice(container, "Informe o nome completo e um login com pelo menos 3 caracteres."); return; }
            if (!/^[a-z0-9._-]+$/.test(username)) { notice(container, "O login só pode conter letras sem acento, números, ponto, hífen e sublinhado."); return; }
            if (users.some(function (x) { return x.username.toLowerCase() === username && x.id !== id; })) { notice(container, "Este login já está cadastrado."); return; }
            const old = users.find(function (x) { return x.id === id; });
            const perms = {};
            MODULES.forEach(function (m) { perms[m[0]] = {}; ACTIONS.forEach(function (a) { perms[m[0]][a[0]] = Boolean(form.elements["perm-" + m[0] + "-" + a[0]].checked); }); });
            const record = {
                id: id, fullName: fullName, cpf: String(fd.get("cpf") || "").trim(),
                email: String(fd.get("email") || "").trim(), phone: String(fd.get("phone") || "").trim(),
                username: username, department: String(fd.get("department") || "").trim(),
                position: String(fd.get("position") || "").trim(), role: String(fd.get("role") || "Consulta"),
                admissionDate: String(fd.get("admissionDate") || ""), status: String(fd.get("status") || "Ativo"),
                notes: String(fd.get("notes") || "").trim(), permissions: perms,
                systemDefault: Boolean(old && old.systemDefault), createdAt: old ? old.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            if (old) users = users.map(function (x) { return x.id === id ? record : x; });
            else users.push(record);
            if (!save()) { notice(container, "Não foi possível salvar no armazenamento local."); return; }
            search = "";
            render(container);
            notice(container, old ? "Usuário atualizado com sucesso." : "Usuário cadastrado com sucesso.");
        });
        iconRefresh();
        form.querySelector('[name="fullName"]')?.focus();
    }

    window.PRIMEUsers = {
        render: render,
        getUsers: function () { return users.map(function (u) { return Object.assign({}, u); }); },
        hasPermission: hasPermission,
        modules: MODULES,
        actions: ACTIONS
    };
})();