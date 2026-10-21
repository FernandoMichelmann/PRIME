"use strict";

/*
 * PRIME Settings v1
 * Preferences are stored locally in this browser. This module does not pretend
 * to provide server-side accounts, permissions, cloud sync, or integrations.
 */
(() => {
    const KEY = "primeSettingsV1";
    const DEFAULTS = {
        language: "pt-BR",
        theme: "dark",
        company: {},
        finance: { currency: "BRL", openingBalance: "", openingDate: "" },
        alerts: { payableDays: 3, receivableDays: 3, overdue: true, negativeBalance: true },
        updatedAt: null
    };
    const $ = (s, root = document) => root.querySelector(s);
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[c]);
    const copy = value => JSON.parse(JSON.stringify(value));
    let state = load();
    let originalContent = $(".content") ? [...$(".content").children] : null;
    let activeSection = "appearance";

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                ...copy(DEFAULTS), ...parsed,
                company: { ...DEFAULTS.company, ...(parsed.company || {}) },
                finance: { ...DEFAULTS.finance, ...(parsed.finance || {}) },
                alerts: { ...DEFAULTS.alerts, ...(parsed.alerts || {}) }
            };
        } catch (error) {
            console.error("PRIME: não foi possível carregar as configurações.", error);
            return copy(DEFAULTS);
        }
    }

    function persist(next = state) {
        try {
            next.updatedAt = new Date().toISOString();
            localStorage.setItem(KEY, JSON.stringify(next));
            state = next;
            return true;
        } catch (error) {
            console.error("PRIME: falha ao salvar configurações.", error);
            toast(t("saveError"));
            return false;
        }
    }

    const dictionaries = {
        "pt-BR": {
            title:"Configurações", subtitle:"Personalize e gerencie o funcionamento do PRIME.",
            company:"Dados da empresa", preferences:"Preferências do sistema", appearance:"Idioma e aparência",
            finance:"Configurações financeiras", users:"Usuários e permissões", alerts:"Notificações e alertas",
            data:"Dados, backup e segurança", integrations:"Integrações", about:"Sobre o PRIME",
            save:"Salvar alterações", cancel:"Cancelar", saved:"Configurações salvas com sucesso.",
            saveError:"Não foi possível salvar. Verifique o armazenamento do navegador.",
            name:"Razão social", tradeName:"Nome fantasia", cnpj:"CNPJ", stateRegistration:"Inscrição estadual",
            address:"Endereço", number:"Número", complement:"Complemento", district:"Bairro", city:"Cidade",
            state:"Estado", zip:"CEP", phone:"Telefone", email:"E-mail corporativo", responsible:"Responsável",
            logo:"Logotipo (opcional)", companyHelp:"Os dados são salvos neste navegador e podem ser exportados no backup.",
            language:"Idioma de preferência", theme:"Tema", dark:"Escuro", light:"Claro",
            languageHelp:"A preferência será aplicada imediatamente. Traduções abrangem a tela Configurações e os textos cadastrados nesta versão.",
            financeHelp:"Alterações aqui não convertem saldos nem criam receitas. O saldo inicial é uma referência de configuração e ainda não altera o motor financeiro existente.",
            openingBalance:"Saldo inicial de referência", openingDate:"Data de referência", currency:"Moeda padrão",
            payableDays:"Antecedência para alertas de contas a pagar (dias)",
            receivableDays:"Antecedência para alertas de contas a receber (dias)",
            overdue:"Exibir alertas de contas vencidas", negativeBalance:"Alertar saldo projetado negativo",
            alertsHelp:"Preferências salvas localmente. A integração automática com notificações depende de implementação no motor de alertas.",
            usersTitle:"Administração de usuários não disponível",
            usersHelp:"Esta versão não possui autenticação/backend que permita aplicar permissões reais. Não é seguro simular controle de acesso apenas na interface.",
            export:"Exportar backup JSON", import:"Restaurar backup JSON", chooseFile:"Selecionar arquivo de backup",
            backupHelp:"O backup inclui as configurações PRIME armazenadas por este módulo. Não substitui backup completo de todos os módulos ou do navegador.",
            backupSuccess:"Backup de configurações exportado.", backupInvalid:"Arquivo inválido. Nenhum dado foi alterado.",
            backupConfirm:"A restauração substituirá as configurações deste módulo. Deseja continuar?",
            integrationsTitle:"Integrações externas", integrationsHelp:"Nenhuma integração bancária, fiscal ou contábil está conectada nesta versão.",
            appName:"PRIME — Gestão Financeira", version:"Versão não definida no repositório.",
            localOnly:"Armazenamento local", localOnlyHelp:"As preferências e os dados desta tela ficam neste navegador. Não há sincronização automática entre dispositivos.",
            cnpjInvalid:"Confira o CNPJ informado.", emailInvalid:"Informe um e-mail válido.",
            required:"Preencha pelo menos a razão social ou o nome fantasia.", cancelConfirm:"Descartar as alterações não salvas?",
            backupDate:"Última atualização das configurações"
        },
        "en": {
            title:"Settings", subtitle:"Customize and manage how PRIME works.", company:"Company details",
            preferences:"System preferences", appearance:"Language and appearance", finance:"Financial settings",
            users:"Users and permissions", alerts:"Notifications and alerts", data:"Data, backup and security",
            integrations:"Integrations", about:"About PRIME", save:"Save changes", cancel:"Cancel",
            saved:"Settings saved successfully.", saveError:"Could not save. Check browser storage.",
            name:"Legal business name", tradeName:"Trade name", cnpj:"Tax ID (CNPJ)", stateRegistration:"State registration",
            address:"Address", number:"Number", complement:"Address line 2", district:"District", city:"City",
            state:"State / Province", zip:"Postal code", phone:"Phone", email:"Business email", responsible:"Contact person",
            logo:"Logo (optional)", companyHelp:"Details are stored in this browser and can be exported in a backup.",
            language:"Preferred language", theme:"Theme", dark:"Dark", light:"Light",
            languageHelp:"The preference applies immediately. In this version, translations cover Settings and the settings labels.",
            financeHelp:"These options do not convert balances or create revenue. Opening balance is a reference and does not yet change the existing finance engine.",
            openingBalance:"Reference opening balance", openingDate:"Reference date", currency:"Default currency",
            payableDays:"Payables alert lead time (days)", receivableDays:"Receivables alert lead time (days)",
            overdue:"Show overdue account alerts", negativeBalance:"Alert on negative projected balance",
            alertsHelp:"Preferences are stored locally. Automatic alerts require integration with the alert engine.",
            usersTitle:"User administration unavailable",
            usersHelp:"This version has no authentication/backend for enforcing real permissions. Access control cannot safely be simulated in the interface.",
            export:"Export settings backup (JSON)", import:"Restore settings backup (JSON)", chooseFile:"Choose backup file",
            backupHelp:"The backup includes settings stored by this module. It is not a full backup of every module or browser data.",
            backupSuccess:"Settings backup exported.", backupInvalid:"Invalid file. No data was changed.",
            backupConfirm:"Restoring will replace this module's settings. Continue?",
            integrationsTitle:"External integrations", integrationsHelp:"No banking, tax, or accounting integrations are connected in this version.",
            appName:"PRIME — Financial Management", version:"Version not defined in the repository.",
            localOnly:"Local storage", localOnlyHelp:"Settings are stored in this browser. They are not automatically synchronized across devices.",
            cnpjInvalid:"Please check the CNPJ number.", emailInvalid:"Enter a valid email address.",
            required:"Enter at least a legal business name or trade name.", cancelConfirm:"Discard unsaved changes?",
            backupDate:"Last settings update"
        },
        "es": {
            title:"Configuración", subtitle:"Personaliza y administra el funcionamiento de PRIME.",
            company:"Datos de la empresa", preferences:"Preferencias del sistema", appearance:"Idioma y apariencia",
            finance:"Configuración financiera", users:"Usuarios y permisos", alerts:"Notificaciones y alertas",
            data:"Datos, copias de seguridad y seguridad", integrations:"Integraciones", about:"Acerca de PRIME",
            save:"Guardar cambios", cancel:"Cancelar", saved:"Configuración guardada correctamente.",
            saveError:"No se pudo guardar. Comprueba el almacenamiento del navegador.",
            name:"Razón social", tradeName:"Nombre comercial", cnpj:"Identificación fiscal (CNPJ)",
            stateRegistration:"Registro estatal", address:"Dirección", number:"Número", complement:"Complemento",
            district:"Barrio", city:"Ciudad", state:"Estado / Provincia", zip:"Código postal", phone:"Teléfono",
            email:"Correo corporativo", responsible:"Responsable", logo:"Logotipo (opcional)",
            companyHelp:"Los datos se guardan en este navegador y pueden exportarse en una copia de seguridad.",
            language:"Idioma preferido", theme:"Tema", dark:"Oscuro", light:"Claro",
            languageHelp:"La preferencia se aplica inmediatamente. En esta versión, las traducciones cubren Configuración y sus etiquetas.",
            financeHelp:"Estas opciones no convierten saldos ni crean ingresos. El saldo inicial es una referencia y aún no modifica el motor financiero existente.",
            openingBalance:"Saldo inicial de referencia", openingDate:"Fecha de referencia", currency:"Moneda predeterminada",
            payableDays:"Anticipación de alertas de cuentas por pagar (días)",
            receivableDays:"Anticipación de alertas de cuentas por cobrar (días)",
            overdue:"Mostrar alertas de cuentas vencidas", negativeBalance:"Alertar saldo proyectado negativo",
            alertsHelp:"Las preferencias se guardan localmente. Las alertas automáticas requieren integración con el motor de alertas.",
            usersTitle:"Administración de usuarios no disponible",
            usersHelp:"Esta versión no dispone de autenticación/backend para aplicar permisos reales. No es seguro simular el control de acceso solo en la interfaz.",
            export:"Exportar copia de configuración (JSON)", import:"Restaurar copia de configuración (JSON)",
            chooseFile:"Seleccionar archivo de copia", backupHelp:"La copia incluye la configuración de este módulo. No sustituye una copia completa de todos los módulos.",
            backupSuccess:"Copia de configuración exportada.", backupInvalid:"Archivo no válido. No se modificaron los datos.",
            backupConfirm:"La restauración reemplazará la configuración de este módulo. ¿Deseas continuar?",
            integrationsTitle:"Integraciones externas", integrationsHelp:"Esta versión no tiene integraciones bancarias, fiscales o contables conectadas.",
            appName:"PRIME — Gestión financiera", version:"Versión no definida en el repositorio.",
            localOnly:"Almacenamiento local", localOnlyHelp:"La configuración se guarda en este navegador y no se sincroniza automáticamente entre dispositivos.",
            cnpjInvalid:"Comprueba el CNPJ indicado.", emailInvalid:"Introduce un correo válido.",
            required:"Introduce al menos la razón social o el nombre comercial.", cancelConfirm:"¿Descartar los cambios sin guardar?",
            backupDate:"Última actualización de la configuración"
        }
    };

    const t = key => dictionaries[state.language]?.[key] || dictionaries["pt-BR"][key] || key;
    function toast(message) {
        const el = $("#toast");
        if (el) {
            el.textContent = message;
            el.hidden = false;
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => el.hidden = true, 3200);
        } else alert(message);
    }
    function applyPreferences() {
        document.documentElement.lang = state.language;
        document.documentElement.dataset.theme = state.theme;
        document.documentElement.style.colorScheme = state.theme === "light" ? "light" : "dark";
        try { localStorage.setItem(KEY, JSON.stringify(state)); }
        catch (error) { console.error("Não foi possível persistir as preferências.", error); }
    }
    function render() {
        const content = $(".content");
        if (!content) return;
        content.innerHTML = `
        <section class="prime-settings">
          <header class="settings-header">
            <div><div class="eyebrow">PRIME / ADMINISTRAÇÃO</div><h1>${t("title")}<span class="blue-period">.</span></h1><p>${t("subtitle")}</p></div>
          </header>
          <div class="settings-layout">
            <nav class="settings-nav" aria-label="${t("title")}">
              ${[["preferences","preferences"],["appearance","appearance"],["finance","finance"],["alerts","alerts"],["data","data"],["integrations","integrations"],["about","about"]].map(([id,key])=>`<button type="button" data-settings-tab="${id}" class="${activeSection===id?"active":""}">${t(key)}</button>`).join("")}
            </nav>
            <div class="settings-panel" id="settingsPanel">${sectionMarkup()}</div>
          </div>
          <p class="settings-local-note"><strong>${t("localOnly")}:</strong> ${t("localOnlyHelp")}</p>
        </section>`;
        bind();
        if (window.lucide) window.lucide.createIcons();
    }
    function sectionMarkup() {
        const c = state.company, f = state.finance, a = state.alerts;
        if (activeSection === "company") return `
          <form id="companyForm" class="settings-form">
            <div class="settings-section-heading"><h2>${t("company")}</h2><p>${t("companyHelp")}</p></div>
            <div class="settings-fields">
              ${field("legalName","name",c.legalName)} ${field("tradeName","tradeName",c.tradeName)}
              ${field("cnpj","cnpj",c.cnpj,"text",'inputmode="numeric"')}
              ${field("stateRegistration","stateRegistration",c.stateRegistration)}
              ${field("address","address",c.address)} ${field("number","number",c.number)}
              ${field("complement","complement",c.complement)} ${field("district","district",c.district)}
              ${field("city","city",c.city)} ${field("state","state",c.state)}
              ${field("zip","zip",c.zip)} ${field("phone","phone",c.phone)}
              ${field("email","email",c.email,"email")} ${field("responsible","responsible",c.responsible)}
            </div>
            <div class="settings-actions"><button class="button-primary" type="submit">${t("save")}</button><button class="button-secondary" type="button" data-cancel>${t("cancel")}</button></div>
          </form>`;
        if (activeSection === "preferences" || activeSection === "appearance") return `
          <div class="settings-section-heading"><h2>${t("appearance")}</h2><p>${t("languageHelp")}</p></div>
          <div class="settings-preference">
            <label for="settingsLanguage">${t("language")}</label>
            <select id="settingsLanguage"><option value="pt-BR" ${state.language==="pt-BR"?"selected":""}>Português (Brasil)</option><option value="en" ${state.language==="en"?"selected":""}>English</option><option value="es" ${state.language==="es"?"selected":""}>Español</option></select>
          </div>
          <div class="settings-preference"><label for="settingsTheme">${t("theme")}</label><select id="settingsTheme"><option value="dark" ${state.theme==="dark"?"selected":""}>${t("dark")}</option><option value="light" ${state.theme==="light"?"selected":""}>${t("light")}</option></select></div>
          <div class="settings-actions"><button class="button-primary" type="button" data-save-prefs>${t("save")}</button></div>`;
        if (activeSection === "finance") return `
          <div class="settings-section-heading"><h2>${t("finance")}</h2><p>${t("financeHelp")}</p></div>
          <form id="financeForm"><div class="settings-fields">
            ${field("openingBalance","openingBalance",f.openingBalance,"number",'step="0.01"')}
            ${field("openingDate","openingDate",f.openingDate,"date")}
            <label class="settings-field"><span>${t("currency")}</span><select name="currency"><option value="BRL" ${f.currency==="BRL"?"selected":""}>BRL — Real brasileiro</option></select></label>
          </div><div class="settings-actions"><button class="button-primary" type="submit">${t("save")}</button><button class="button-secondary" type="button" data-cancel>${t("cancel")}</button></div></form>`;
        if (activeSection === "alerts") return `
          <div class="settings-section-heading"><h2>${t("alerts")}</h2><p>${t("alertsHelp")}</p></div>
          <form id="alertsForm"><div class="settings-fields">
            ${field("payableDays","payableDays",a.payableDays,"number",'min="0" max="365"')}
            ${field("receivableDays","receivableDays",a.receivableDays,"number",'min="0" max="365"')}
          </div><label class="settings-check"><input name="overdue" type="checkbox" ${a.overdue?"checked":""}> ${t("overdue")}</label>
          <label class="settings-check"><input name="negativeBalance" type="checkbox" ${a.negativeBalance?"checked":""}> ${t("negativeBalance")}</label>
          <div class="settings-actions"><button class="button-primary" type="submit">${t("save")}</button></div></form>`;
        if (activeSection === "users") return `<div class="settings-info"><h2>${t("usersTitle")}</h2><p>${t("usersHelp")}</p></div>`;
        if (activeSection === "data") return `
          <div class="settings-section-heading"><h2>${t("data")}</h2><p>${t("backupHelp")}</p></div>
          <div class="settings-backup"><button class="button-primary" type="button" data-export>${t("export")}</button><label class="button-secondary settings-file-button">${t("import")}<input type="file" id="settingsImport" accept="application/json,.json" hidden></label></div>
          <p class="settings-muted">${t("backupDate")}: ${state.updatedAt ? esc(new Date(state.updatedAt).toLocaleString(state.language)) : "—"}</p>`;
        if (activeSection === "integrations") return `<div class="settings-info"><h2>${t("integrationsTitle")}</h2><p>${t("integrationsHelp")}</p></div>`;
        return `<div class="settings-info"><h2>${t("appName")}</h2><p>${t("version")}</p><p><strong>${t("localOnly")}</strong> — ${t("localOnlyHelp")}</p></div>`;
    }
    function field(name, key, value, type = "text", extra = "") {
        return `<label class="settings-field"><span>${t(key)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
    }
    function bind() {
        $$("[data-settings-tab]").forEach(btn => btn.addEventListener("click", () => {
            activeSection = btn.dataset.settingsTab; render();
        }));
        $("#companyForm")?.addEventListener("submit", e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget), c = { ...state.company };
            for (const key of ["legalName","tradeName","cnpj","stateRegistration","address","number","complement","district","city","state","zip","phone","email","responsible"]) {
                const value = String(fd.get(key) || "").trim();
                if (value || c[key]) c[key] = value;
            }
            if (!c.legalName && !c.tradeName) return toast(t("required"));
            if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return toast(t("emailInvalid"));
            if (c.cnpj && !validCNPJ(c.cnpj)) return toast(t("cnpjInvalid"));
            const next = { ...state, company: c };
            if (persist(next)) { toast(t("saved")); render(); }
        });
        $("#financeForm")?.addEventListener("submit", e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget), amount = String(fd.get("openingBalance") || "").trim();
            if (amount && !Number.isFinite(Number(amount))) return toast(t("financeHelp"));
            if (amount && !fd.get("openingDate")) return toast(t("financeHelp"));
            const next = { ...state, finance: { openingBalance: amount, openingDate: String(fd.get("openingDate")||""), currency: "BRL" } };
            if (persist(next)) { toast(t("saved")); render(); }
        });
        $("#alertsForm")?.addEventListener("submit", e => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            const payableDays = Number(fd.get("payableDays")), receivableDays = Number(fd.get("receivableDays"));
            if (![payableDays,receivableDays].every(n => Number.isInteger(n) && n >= 0 && n <= 365)) return toast("Informe dias entre 0 e 365.");
            const next = { ...state, alerts: { payableDays, receivableDays, overdue: fd.has("overdue"), negativeBalance: fd.has("negativeBalance") } };
            if (persist(next)) { toast(t("saved")); render(); }
        });
        $("#settingsLanguage")?.addEventListener("change", e => {
            state.language = e.target.value; applyPreferences(); render();
        });
        $("#settingsTheme")?.addEventListener("change", e => {
            state.theme = e.target.value; applyPreferences();
        });
        $("[data-save-prefs]")?.addEventListener("click", () => {
            if (persist({ ...state })) { applyPreferences(); toast(t("saved")); render(); }
        });
        $$("[data-cancel]").forEach(btn => btn.addEventListener("click", () => {
            if (!confirm(t("cancelConfirm"))) return;
            state = load(); applyPreferences(); render();
        }));
        $("[data-export]")?.addEventListener("click", exportBackup);
        $("#settingsImport")?.addEventListener("change", importBackup);
    }
    function validCNPJ(input) {
        const cnpj = String(input).replace(/\D/g, "");
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
        const digit = (base, weights) => {
            const sum = base.split("").reduce((total, n, i) => total + Number(n) * weights[i], 0);
            const rest = sum % 11; return rest < 2 ? 0 : 11 - rest;
        };
        const first = digit(cnpj.slice(0,12), [5,4,3,2,9,8,7,6,5,4,3,2]);
        const second = digit(cnpj.slice(0,12)+first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
        return cnpj.endsWith(String(first)+String(second));
    }
    function exportBackup() {
        const payload = { format:"PRIME_SETTINGS_BACKUP", version:1, exportedAt:new Date().toISOString(), settings:state };
        const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href=url; link.download="prime-settings-backup.json"; link.click(); URL.revokeObjectURL(url);
        toast(t("backupSuccess"));
    }
    async function importBackup(event) {
        const file = event.target.files?.[0]; if (!file) return;
        try {
            const payload = JSON.parse(await file.text());
            if (payload.format !== "PRIME_SETTINGS_BACKUP" || payload.version !== 1 ||
                !payload.settings || !["pt-BR","en","es"].includes(payload.settings.language) ||
                !["dark","light"].includes(payload.settings.theme) ||
                typeof payload.settings.company !== "object" || typeof payload.settings.finance !== "object" ||
                typeof payload.settings.alerts !== "object") throw new Error("Invalid backup schema");
            if (!confirm(t("backupConfirm"))) return;
            const next = { ...copy(DEFAULTS), ...payload.settings,
                company:{...DEFAULTS.company,...payload.settings.company},
                finance:{...DEFAULTS.finance,...payload.settings.finance},
                alerts:{...DEFAULTS.alerts,...payload.settings.alerts} };
            if (persist(next)) { applyPreferences(); toast(t("saved")); render(); }
        } catch (error) {
            console.error("Falha ao restaurar backup:", error); toast(t("backupInvalid"));
        } finally { event.target.value = ""; }
    }
    function $$(selector, root = document) { return [...root.querySelectorAll(selector)]; }
    function openSettings() {
        const content = $(".content");
        if (!content) return;
        if (!originalContent) originalContent = [...content.children];
        render();
        if (location.hash !== "#settings") history.replaceState(null, "", "#settings");
    }
    function restoreContent() {
        const content = $(".content");
        if (!content || !originalContent) return;
        content.replaceChildren(...originalContent);
        if (location.hash === "#settings") history.replaceState(null, "", "#dashboard");
    }
    document.addEventListener("click", event => {
        const item = event.target.closest('.nav-item[data-page="Configurações"], .nav-item[href="#settings"]');
        if (item) {
            event.preventDefault(); event.stopImmediatePropagation();
            $$(".nav-item").forEach(nav => nav.classList.toggle("active", nav === item));
            $("#currentPage").textContent = t("title");
            openSettings();
        }
    }, true);
    document.addEventListener("click", event => {
        const item = event.target.closest('.nav-item[data-page="Dashboard"], .nav-item[href="#dashboard"]');
        if (!item) return;
        if ($(".prime-settings")) {
            event.preventDefault(); event.stopImmediatePropagation();
            $$(".nav-item").forEach(nav => nav.classList.toggle("active", nav === item));
            $("#currentPage").textContent = "Dashboard";
            restoreContent();
        }
    }, true);
    window.addEventListener("hashchange", () => {
        if (location.hash === "#settings") openSettings();
    });
    applyPreferences();
})();
