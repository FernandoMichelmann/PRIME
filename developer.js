(() => {
  "use strict";
  const API_BASE = "http://127.0.0.1:8000/api/v1";
  const $ = (s) => document.querySelector(s);
  let token = sessionStorage.getItem("primeDeveloperToken") || "";
  let currentUser = null;\n  let selectedCompanyId = null;
  const escapeHTML = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function api(path, options = {}) {
    const response = await fetch(API_BASE + path, {
      ...options,
      headers: {"Content-Type":"application/json", ...(token ? {"Authorization":"Bearer " + token} : {}), ...(options.headers || {})}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || "Não foi possível concluir a operação.");
    return body;
  }
  function message(selector, text, kind = "") {
    const el = $(selector); el.textContent = text; el.className = "developer-message" + (kind ? " " + kind : "");
  }
  function showApp(user) {
    currentUser = user;
    $("#loginView").hidden = true; $("#appView").hidden = false; $("#logoutButton").hidden = false;
    $("#developerName").textContent = user.full_name;
    $("#developerEmail").textContent = user.email;
    if (window.lucide) window.lucide.createIcons();
  }
  function logout() {
    token = ""; currentUser = null; sessionStorage.removeItem("primeDeveloperToken");
    $("#loginView").hidden = false; $("#appView").hidden = true; $("#logoutButton").hidden = true;
    $("#loginForm").reset(); message("#loginMessage", "Sessão encerrada.");
  }
  async function authenticate() {
    const user = await api("/auth/me");
    if (!user.is_platform_admin) { logout(); throw new Error("Esta conta não tem permissão de desenvolvedor."); }
    showApp(user);
    await loadCompanies();
  }
  async function loadCompanies() {
    const companies = await api("/developer/companies");
    $("#companyCount").textContent = companies.length;
    $("#activeCount").textContent = companies.filter(c => c.is_active).length;
    $("#inactiveCount").textContent = companies.filter(c => !c.is_active).length;
    const list = $("#companyList");
    if (!companies.length) { list.innerHTML = '<div class="developer-empty">Nenhuma transportadora cadastrada. Use o formulário ao lado para criar a primeira.</div>'; return; }
    list.innerHTML = companies.map(c => `<article class="developer-company-card">
      <div class="developer-company-card-head"><div><strong>${escapeHTML(c.trade_name || c.legal_name)}</strong><small>${escapeHTML(c.legal_name)}<br>Identificador: ${escapeHTML(c.slug)}${c.cnpj ? "<br>CNPJ: " + escapeHTML(c.cnpj) : ""}</small></div>
      <span class="company-status ${c.is_active ? "active" : "inactive"}">${c.is_active ? "Ativa" : "Inativa"}</span></div>
      <div class="developer-company-actions"><button class="button-secondary" data-create-admin="${c.id}" data-company-name="${escapeHTML(c.trade_name || c.legal_name)}">Criar administrador</button><button class="button-secondary" data-toggle-company="${c.id}" data-active="${c.is_active}">${c.is_active ? "Desativar empresa" : "Reativar empresa"}</button></div>
    </article>`).join("");
    list.querySelectorAll("[data-create-admin]").forEach(btn => btn.addEventListener("click", () => {
      selectedCompanyId = btn.dataset.createAdmin;
      $("#adminCompanyName").textContent = btn.dataset.companyName;
      $("#adminForm").reset(); message("#adminMessage", "");
      $("#adminDialog").showModal();
    }));
    list.querySelectorAll("[data-toggle-company]").forEach(btn => btn.addEventListener("click", async () => {
      const desired = btn.dataset.active !== "true";
      const action = desired ? "reativar" : "desativar";
      if (!confirm(`Confirma ${action} esta transportadora?`)) return;
      btn.disabled = true;
      try { await api(`/developer/companies/${btn.dataset.toggleCompany}/status`, {method:"PATCH",body:JSON.stringify({is_active:desired})}); await loadCompanies(); message("#globalMessage","Status da transportadora atualizado.","success"); }
      catch (e) { message("#globalMessage",e.message,"error"); btn.disabled = false; }
    }));
  }
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = event.currentTarget.querySelector("button"); button.disabled = true;
    message("#loginMessage","Validando credenciais…");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/auth/login",{method:"POST",body:JSON.stringify(data)});
      token = result.access_token; sessionStorage.setItem("primeDeveloperToken",token);
      await authenticate(); message("#globalMessage","Acesso autorizado.","success");
    } catch(e) { logout(); message("#loginMessage",e.message,"error"); }
    finally { button.disabled = false; }
  });
  $("#companyForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    if (!data.trade_name) data.trade_name = null;
    if (!data.cnpj) data.cnpj = null;
    try {
      const created = await api("/developer/companies",{method:"POST",body:JSON.stringify(data)});
      form.reset(); await loadCompanies();
      message("#companyMessage",`Transportadora cadastrada. Administrador: ${created.admin_email}. Guarde a senha com segurança e não a compartilhe por canais inseguros.`,"success");
    } catch(e) { message("#companyMessage",e.message,"error"); }
    finally { button.disabled = false; }
  });
  $("#closeAdminDialog").addEventListener("click", () => $("#adminDialog").close());
  $("#adminForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedCompanyId) return;
    const form = event.currentTarget; const button = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form)); button.disabled = true;
    try {
      await api(`/developer/companies/${selectedCompanyId}/admins`, {method:"POST", body:JSON.stringify(data)});
      $("#adminDialog").close(); form.reset();
      message("#globalMessage", "Administrador criado com sucesso.", "success");
    } catch(e) { message("#adminMessage", e.message, "error"); }
    finally { button.disabled = false; }
  });
  $("#refreshButton").addEventListener("click", async () => { try { await loadCompanies(); message("#globalMessage","Lista atualizada.","success"); } catch(e) { message("#globalMessage",e.message,"error"); } });
  $("#logoutButton").addEventListener("click", logout);
  if (window.lucide) window.lucide.createIcons();
  if (token) authenticate().catch(e => { logout(); message("#loginMessage",e.message,"error"); });
})();
