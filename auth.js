(() => {
    "use strict";
    const API_BASE = window.PRIME_API_BASE || "http://127.0.0.1:8000/api/v1";
    const TOKEN_KEY = "primeAccessToken";
    const USER_KEY = "primeAuthenticatedUser";
    let token = sessionStorage.getItem(TOKEN_KEY) || "";

    const style = document.createElement("style");
    style.textContent = [
        "body.prime-auth-locked{overflow:hidden}",
        "body.prime-auth-locked .app-shell{visibility:hidden!important}",
        "#primeAuthScreen{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at top,#102443 0%,#050B16 58%);color:#F1F5F9;font-family:Montserrat,sans-serif}",
        "#primeAuthScreen[hidden]{display:none!important}",
        ".prime-auth-card{width:min(100%,420px);padding:34px;background:rgba(10,18,32,.97);border:1px solid #1C2B40;border-radius:14px;box-shadow:0 24px 80px #0008}",
        ".prime-auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:30px}",
        ".prime-auth-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:9px;background:linear-gradient(145deg,#438BFF,#1554BC);font-size:28px;font-weight:800;font-style:italic}",
        ".prime-auth-brand strong{display:block;font-size:22px;letter-spacing:3px}",
        ".prime-auth-brand small{display:block;margin-top:3px;color:#94A3B8;font-size:8px;letter-spacing:.7px}",
        ".prime-auth-card h1{margin:0 0 8px;font-size:23px}",
        ".prime-auth-subtitle{margin:0 0 24px;color:#94A3B8;font-size:12px;line-height:1.7}",
        ".prime-auth-field{display:block;margin:0 0 16px}",
        ".prime-auth-field span{display:block;margin-bottom:7px;color:#CBD5E1;font-size:11px;font-weight:600}",
        ".prime-auth-field input{width:100%;height:44px;padding:0 12px;border:1px solid #263851;border-radius:7px;background:#070E1A;color:#F1F5F9;font:inherit;font-size:13px;outline:none}",
        ".prime-auth-field input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px #3B82F622}",
        "#primeAuthSubmit{width:100%;min-height:44px;margin-top:5px;border:0;border-radius:7px;background:#2563EB;color:white;font:inherit;font-size:12px;font-weight:700;cursor:pointer}",
        "#primeAuthSubmit:hover{background:#3B82F6}",
        "#primeAuthSubmit:disabled{opacity:.65;cursor:wait}",
        "#primeAuthMessage{min-height:20px;margin:12px 0 0;color:#F87171;font-size:11px;line-height:1.6}",
        ".prime-auth-foot{margin-top:20px;color:#64748B;text-align:center;font-size:10px}",
        "#primeAuthLogout{margin-left:10px;padding:7px 10px;border:1px solid #263851;border-radius:6px;background:#0A1321;color:#CBD5E1;font:inherit;font-size:10px;cursor:pointer}",
        "#primeAuthLogout:hover{border-color:#3B82F6;color:white}",
        "@media(max-width:480px){.prime-auth-card{padding:25px 20px}}"
    ].join("");
    document.head.appendChild(style);
    document.body.classList.add("prime-auth-locked");

    const screen = document.createElement("section");
    screen.id = "primeAuthScreen";
    screen.setAttribute("aria-label", "Acesso ao PRIME");
    screen.innerHTML = '<div class="prime-auth-card">' +
        '<div class="prime-auth-brand"><div class="prime-auth-mark">P</div><div><strong>PRIME</strong><small>BUSINESS FINANCIAL MANAGEMENT</small></div></div>' +
        '<h1>Acesse sua conta</h1><p class="prime-auth-subtitle">Entre com suas credenciais para acessar o ambiente de gestão do PRIME.</p>' +
        '<form id="primeAuthForm"><label class="prime-auth-field"><span>E-mail</span><input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="seu@email.com"></label>' +
        '<label class="prime-auth-field"><span>Senha</span><input name="password" type="password" autocomplete="current-password" required maxlength="256" placeholder="Digite sua senha"></label>' +
        '<button id="primeAuthSubmit" type="submit">Entrar no PRIME</button><p id="primeAuthMessage" role="alert" aria-live="polite"></p></form>' +
        '<div class="prime-auth-foot">Acesso protegido por autenticação do PRIME.</div></div>';
    document.body.appendChild(screen);

    const form = screen.querySelector("#primeAuthForm");
    const submit = screen.querySelector("#primeAuthSubmit");
    const message = screen.querySelector("#primeAuthMessage");

    function lockScreen(text) {
        document.body.classList.add("prime-auth-locked");
        screen.hidden = false;
        message.textContent = text || "";
    }

    function unlockScreen(user) {
        document.body.classList.remove("prime-auth-locked");
        screen.hidden = true;
        const profile = document.querySelector(".profile");
        if (!profile) return;
        const name = profile.querySelector(".profile-info strong");
        const role = profile.querySelector(".profile-info span");
        const avatar = profile.querySelector(".avatar");
        if (name) name.textContent = user.full_name || user.email;
        if (role) role.textContent = user.is_platform_admin ? "Administrador da plataforma" :
            ((user.memberships || []).length ? user.memberships[0].role_name : "Usuário autenticado");
        if (avatar) avatar.textContent = String(user.full_name || user.email).trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
        if (!document.querySelector("#primeAuthLogout")) {
            const button = document.createElement("button");
            button.id = "primeAuthLogout";
            button.type = "button";
            button.textContent = "Sair";
            button.addEventListener("click", logout);
            profile.insertAdjacentElement("afterend", button);
        }
    }

    async function request(path, options) {
        const settings = options || {};
        const response = await fetch(API_BASE + path, {
            ...settings,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": "Bearer " + token } : {}),
                ...(settings.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : "Não foi possível validar o acesso.");
        }
        return data;
    }

    function logout() {
        token = "";
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        form.reset();
        lockScreen("Sua sessão foi encerrada. Entre novamente para continuar.");
        const button = document.querySelector("#primeAuthLogout");
        if (button) button.remove();
    }

    async function validateSession() {
        if (!token) {
            lockScreen("");
            return;
        }
        try {
            const user = await request("/auth/me");
            sessionStorage.setItem(USER_KEY, JSON.stringify(user));
            unlockScreen(user);
        } catch (_) {
            token = "";
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
            lockScreen("Sua sessão expirou ou não é válida. Entre novamente.");
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        submit.textContent = "Validando...";
        message.textContent = "";
        const data = Object.fromEntries(new FormData(form));
        try {
            const result = await request("/auth/login", {
                method: "POST",
                body: JSON.stringify(data)
            });
            token = result.access_token;
            sessionStorage.setItem(TOKEN_KEY, token);
            const user = await request("/auth/me");
            sessionStorage.setItem(USER_KEY, JSON.stringify(user));
            form.reset();
            unlockScreen(user);
        } catch (error) {
            token = "";
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
            lockScreen(error.message || "Não foi possível entrar. Confira suas credenciais e a conexão com a API.");
        } finally {
            submit.disabled = false;
            submit.textContent = "Entrar no PRIME";
        }
    });

    function requestCompany(path, options) {
        let user = {};
        try { user = JSON.parse(sessionStorage.getItem(USER_KEY) || "{}"); } catch (_) {}
        const memberships = Array.isArray(user.memberships) ? user.memberships : [];
        const selected = sessionStorage.getItem("primeCompanyId");
        const membership = memberships.find(item => item.company_id === selected) || memberships[0];
        if (!membership || !membership.company_id) {
            throw new Error("Seu usuário não possui vínculo ativo com uma transportadora no PRIME.");
        }
        return request(path, {
            ...(options || {}),
            headers: {
                ...((options && options.headers) || {}),
                "X-Company-ID": membership.company_id
            }
        });
    }

    window.PRIMEAuth = {
        request,
        requestCompany,
        getUser: () => {
            try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); }
            catch (_) { return null; }
        },
        getCompanyId: () => {
            try {
                const user = JSON.parse(sessionStorage.getItem(USER_KEY) || "{}");
                const memberships = Array.isArray(user.memberships) ? user.memberships : [];
                const selected = sessionStorage.getItem("primeCompanyId");
                return (memberships.find(item => item.company_id === selected) || memberships[0] || {}).company_id || null;
            } catch (_) { return null; }
        }
    };

    document.addEventListener("DOMContentLoaded", validateSession);
})();