(() => {
    "use strict";

    const style = document.createElement("style");
    style.textContent = `
        .revenue-module{color:var(--text,#E2E8F0);padding:4px 0 28px}
        .revenue-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:22px}
        .revenue-header h1{font-size:clamp(25px,3vw,34px);margin:5px 0 8px;letter-spacing:-.7px}
        .revenue-header p{color:var(--muted,#94A3B8);margin:0;line-height:1.7}
        .revenue-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:20px}
        .revenue-kpi,.revenue-panel{background:var(--surface,#0B1422);border:1px solid var(--border,#1E2D42);border-radius:10px;box-shadow:0 6px 20px #00000012}
        .revenue-kpi{padding:18px;min-width:0}.revenue-kpi span{display:block;color:var(--muted,#94A3B8);font-size:11px;margin-bottom:12px}
        .revenue-kpi strong{font-size:clamp(17px,2vw,24px);overflow-wrap:anywhere}.revenue-kpi small{display:block;color:var(--muted,#94A3B8);font-size:10px;margin-top:8px}
        .revenue-panel{padding:20px;margin-bottom:18px}.revenue-panel-heading{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:17px}
        .revenue-heading-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.revenue-panel-heading h2{margin:0 0 5px;font-size:16px}.revenue-panel-heading p{margin:0;color:var(--muted,#94A3B8);font-size:12px;line-height:1.6}
        .revenue-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
        .revenue-toolbar input,.revenue-toolbar select,.revenue-form input,.revenue-form select,.revenue-form textarea{background:var(--surface-raised,#101E30);border:1px solid var(--border,#263851);border-radius:7px;color:var(--text,#E2E8F0);padding:10px 12px;font:inherit;min-height:39px}
        .revenue-toolbar input{flex:1;min-width:180px}.revenue-toolbar select{min-width:150px}
        .revenue-btn{border:1px solid #2B5D9D;background:#2563EB;color:white;border-radius:7px;padding:10px 14px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
        .revenue-btn:hover{background:#3478F6}.revenue-btn.secondary{background:var(--surface-raised,#101E30);border-color:var(--border,#263851);color:var(--text,#E2E8F0)}
        .revenue-btn:disabled{opacity:.6;cursor:wait}
        .revenue-table-wrap{width:100%;overflow-x:auto}.revenue-table{width:100%;border-collapse:collapse;white-space:nowrap}
        .revenue-table th,.revenue-table td{padding:13px 12px;border-bottom:1px solid var(--border,#1E2D42);text-align:left;vertical-align:middle}
        .revenue-table th{font-size:10px;text-transform:uppercase;letter-spacing:.45px;color:var(--muted,#94A3B8)}.revenue-table td{font-size:12px}
        .revenue-table td strong,.revenue-table td small{display:block}.revenue-table td small{color:var(--muted,#94A3B8);font-size:10px;margin-top:4px}
        .revenue-state{display:inline-flex;padding:5px 8px;border-radius:5px;background:#172A42;color:#A8D1FF;font-size:10px;font-weight:700}
        .revenue-state.paid{background:#12352D;color:#86EFAC}.revenue-actions{display:flex;gap:6px;align-items:center}.revenue-actions .revenue-btn{padding:7px 9px;font-size:11px}.revenue-btn.danger{background:#351A24;border-color:#713044;color:#FCA5A5}.revenue-btn.danger:hover{background:#51202F}.revenue-btn.paid-button{background:#12352D;border-color:#21634F;color:#86EFAC}
        .revenue-empty,.revenue-message{padding:24px;text-align:center;color:var(--muted,#94A3B8);line-height:1.7}.revenue-message.error{color:#FCA5A5}
        .revenue-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.revenue-form label{display:flex;flex-direction:column;gap:7px;color:var(--muted,#94A3B8);font-size:11px;font-weight:600;min-width:0}
        .revenue-form input,.revenue-form select,.revenue-form textarea{width:100%;min-width:0}.revenue-form .wide{grid-column:1/-1}.revenue-form textarea{min-height:78px;resize:vertical}
        .revenue-form-actions{display:flex;justify-content:flex-end;gap:9px;grid-column:1/-1}
        .revenue-dialog{position:fixed;inset:0;z-index:9000;background:#020617CC;display:grid;place-items:center;padding:20px;overflow:auto}
        .revenue-dialog[hidden]{display:none}.revenue-dialog-card{width:min(100%,900px);max-height:calc(100vh - 40px);overflow:auto;background:var(--surface,#0B1422);border:1px solid var(--border,#263851);border-radius:12px;padding:24px;box-shadow:0 25px 90px #0008}
        .revenue-dialog-card h2{margin:0 0 6px}.revenue-dialog-card>p{color:var(--muted,#94A3B8);font-size:12px;margin:0 0 20px}
        @media(max-width:1000px){.revenue-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.revenue-form{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:600px){.revenue-kpis,.revenue-form{grid-template-columns:1fr}.revenue-panel{padding:14px}.revenue-dialog-card{padding:18px}.revenue-form .wide,.revenue-form-actions{grid-column:auto}}
    `;
    document.head.appendChild(style);

    const money = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
    const dateLabel = value => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value + "T00:00:00Z")) : "—";
    const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const today = () => {
        const d = new Date();
        return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
    };

    let container = null;
    let revenues = [];
    let dashboard = null;
    let busy = false;
    let editingReference = null;

    const STORAGE_KEY = "primeRevenueDemoV1";

    function readLocalRevenues() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("[PRIME Receitas] Falha ao ler dados locais:", error);
            return [];
        }
    }

    function persistLocalRevenues() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(revenues));
            return true;
        } catch (error) {
            throw new Error("Não foi possível salvar no navegador. Verifique o espaço disponível.");
        }
    }

    function calculateDashboard(rows) {
        const now = today();
        const month = now.slice(0, 7);
        const total = row => Number(row.total_amount) || 0;
        return {
            billing_total: rows.filter(row => row.billing_status === "faturada").reduce((sum, row) => sum + total(row), 0),
            received_total: rows.filter(row => row.payment_status === "recebido" && String(row.payment_date || "").slice(0, 7) === month).reduce((sum, row) => sum + total(row), 0),
            receivable_balance: rows.filter(row => row.payment_status !== "recebido").reduce((sum, row) => sum + total(row), 0),
            overdue_balance: rows.filter(row => row.payment_status !== "recebido" && row.due_date && row.due_date < now).reduce((sum, row) => sum + total(row), 0),
            pending_billing_total: rows.filter(row => row.billing_status !== "faturada").reduce((sum, row) => sum + total(row), 0)
        };
    }

    function render(containerElement) {
        container = containerElement;
        container.innerHTML = `
            <section class="revenue-module">
                <header class="revenue-header">
                    <div><div class="eyebrow">GESTÃO FINANCEIRA / FATURAMENTO</div><h1>Receitas<span class="blue-period">.</span></h1><p>Controle o faturamento e acompanhe os valores a receber da empresa.</p></div>
                    <button type="button" class="revenue-btn" data-revenue-new>+ Nova receita</button>
                </header>
                <section class="revenue-kpis" aria-label="Indicadores de receitas">
                    <article class="revenue-kpi"><span>FATURAMENTO REGISTRADO</span><strong data-kpi-billing>—</strong><small>Receitas com status faturada</small></article>
                    <article class="revenue-kpi"><span>RECEBIDO NO PERÍODO</span><strong data-kpi-received>—</strong><small>Entradas registradas por data de pagamento</small></article>
                    <article class="revenue-kpi"><span>CONTAS A RECEBER</span><strong data-kpi-balance>—</strong><small>Saldo de títulos em aberto</small></article>
                    <article class="revenue-kpi"><span>VENCIDO</span><strong data-kpi-overdue>—</strong><small>Saldo de títulos vencidos</small></article>
                    <article class="revenue-kpi"><span>PENDENTE DE FATURAMENTO</span><strong data-kpi-pending>—</strong><small>Receitas cadastradas ainda não faturadas</small></article>
                </section>
                <section class="revenue-panel">
                    <div class="revenue-panel-heading"><div><h2>Receitas cadastradas</h2><p>Consulte e gerencie lançamentos demonstrativos salvos neste navegador.</p></div><div class="revenue-heading-actions"><button type="button" class="revenue-btn secondary" data-revenue-export>Exportar CSV</button><button type="button" class="revenue-btn secondary" data-revenue-refresh>Atualizar</button></div></div>
                    <div class="revenue-toolbar"><input type="search" placeholder="Buscar referência, cliente, CT-e ou fatura..." aria-label="Buscar receitas" data-revenue-search><select aria-label="Situação do faturamento" data-revenue-status><option value="">Todas as situações</option><option value="pendente">Pendente de faturamento</option><option value="faturada">Faturada</option></select><button type="button" class="revenue-btn secondary" data-revenue-clear>Limpar</button></div>
                    <div data-revenue-table><div class="revenue-empty">Carregando receitas...</div></div>
                </section>
                <div class="revenue-dialog" data-revenue-dialog hidden>
                    <section class="revenue-dialog-card" role="dialog" aria-modal="true" aria-labelledby="revenueDialogTitle">
                        <h2 id="revenueDialogTitle">Nova receita</h2><p>Modo de demonstração: os dados ficam salvos somente neste navegador.</p>
                        <form class="revenue-form" data-revenue-form>
                            <label>Referência interna *<input name="reference" required maxlength="40" placeholder="REC-2026-0001"></label>
                            <label>Cliente contratante *<input name="customer_name" required maxlength="180"></label>
                            <label>Tipo de receita<select name="category"><option value="frete_fracionado">Frete de carga fracionada</option><option value="frete_lotacao">Frete de lotação</option><option value="transporte_dedicado">Transporte dedicado</option><option value="armazenagem">Armazenagem</option><option value="servico_logistico">Serviço logístico</option><option value="reembolso">Reembolso contratado</option><option value="outra">Outra receita</option></select></label>
                            <label class="wide">Descrição do serviço *<input name="description" required maxlength="500" placeholder="Ex.: transporte rodoviário de carga"></label>
                            <label>Data de competência<input name="competency_date" type="date"></label><label>Data do serviço<input name="service_date" type="date"></label><label>Modalidade de transporte<input name="transport_mode" maxlength="60" placeholder="Fracionado, lotação..."></label>
                            <label>Referência da operação<input name="operation_reference" maxlength="100"></label><label>Número do CT-e<input name="cte_number" maxlength="80"></label><label>Peso (kg)<input name="weight_kg" type="number" min="0" step="0.001"></label>
                            <label>Origem<input name="origin" maxlength="180"></label><label>Destino<input name="destination" maxlength="180"></label><label>Valor-base (R$) *<input name="base_amount" type="number" min="0.01" step="0.01" required></label>
                            <label>Adicionais (R$)<input name="additions_amount" type="number" min="0" step="0.01" value="0"></label><label>Pedágio repassado (R$)<input name="toll_amount" type="number" min="0" step="0.01" value="0"></label><label>Desconto autorizado (R$)<input name="discount_amount" type="number" min="0" step="0.01" value="0"></label>
                            <label class="wide">Observações<textarea name="notes"></textarea></label>
                            <div class="revenue-form-actions"><button type="button" class="revenue-btn secondary" data-revenue-cancel>Cancelar</button><button type="submit" class="revenue-btn">Salvar receita</button></div>
                        </form>
                        <p class="revenue-message" data-revenue-form-message role="status"></p>
                    </section>
                </div>
            </section>`;
        container.querySelector("[data-revenue-new]").addEventListener("click", openForm);
        container.querySelector("[data-revenue-cancel]").addEventListener("click", closeForm);
        container.querySelector("[data-revenue-dialog]").addEventListener("click", event => { if (event.target.matches("[data-revenue-dialog]")) closeForm(); });
        container.querySelector("[data-revenue-refresh]").addEventListener("click", load);
        container.querySelector("[data-revenue-export]").addEventListener("click", exportCSV);
        container.querySelector("[data-revenue-search]").addEventListener("input", filterTable);
        container.querySelector("[data-revenue-status]").addEventListener("change", filterTable);
        container.querySelector("[data-revenue-clear]").addEventListener("click", () => {
            container.querySelector("[data-revenue-search]").value = "";
            container.querySelector("[data-revenue-status]").value = "";
            filterTable();
        });
        container.querySelector("[data-revenue-form]").addEventListener("submit", save);
        container.querySelector("[data-revenue-table]").addEventListener("click", handleRevenueAction);
        load();
    }

    function exportCSV() {
        const term = container.querySelector("[data-revenue-search]").value.trim().toLocaleLowerCase("pt-BR");
        const state = container.querySelector("[data-revenue-status]").value;
        const rows = revenues.filter(row => {
            const text = [row.reference, row.customer_name, row.description, row.cte_number, row.invoice_number]
                .join(" ").toLocaleLowerCase("pt-BR");
            return (!term || text.includes(term)) && (!state || row.billing_status === state);
        });
        const columns = [
            ["Referência", "reference"], ["Cliente", "customer_name"], ["Descrição", "description"],
            ["Categoria", "category"], ["Modalidade", "transport_mode"], ["CT-e", "cte_number"],
            ["Competência", "competency_date"], ["Data do serviço", "service_date"],
            ["Faturamento", "issue_date"], ["Situação", "billing_status"],
            ["Valor-base", "base_amount"], ["Adicionais", "additions_amount"],
            ["Pedágio", "toll_amount"], ["Desconto", "discount_amount"], ["Total", "total_amount"]
        ];
        const quote = value => '"' + String(value ?? "").replace(/"/g, '""') + '"';
        const csv = "\\uFEFF" + [
            columns.map(column => quote(column[0])).join(";"),
            ...rows.map(row => columns.map(column => quote(row[column[1]])).join(";"))
        ].join("\\r\\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "prime-receitas-" + today() + ".csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function openForm(record = null) {
        const form = container.querySelector("[data-revenue-form]");
        form.reset();
        editingReference = record ? record.reference : null;
        container.querySelector("#revenueDialogTitle").textContent = record ? "Editar receita" : "Nova receita";
        form.querySelector('[type="submit"]').textContent = record ? "Salvar alterações" : "Salvar receita";
        const message = container.querySelector("[data-revenue-form-message]");
        message.textContent = "";
        message.classList.remove("error");
        if (record) Object.entries(record).forEach(([key, value]) => {
            const field = form.elements.namedItem(key);
            if (field && value !== null && value !== undefined) field.value = value;
        });
        container.querySelector("[data-revenue-dialog]").hidden = false;
        form.querySelector('[name="reference"]').focus();
    }
    function closeForm() {
        container.querySelector("[data-revenue-dialog]").hidden = true;
        editingReference = null;
    }

    function handleRevenueAction(event) {
        const button = event.target.closest("[data-revenue-action]");
        if (!button || busy) return;
        const reference = button.dataset.reference;
        const record = revenues.find(row => row.reference === reference);
        if (!record) return;
        if (button.dataset.revenueAction === "edit") {
            openForm(record);
        } else if (button.dataset.revenueAction === "delete") {
            if (!window.confirm("Excluir a receita " + record.reference + " de " + record.customer_name + "? Esta ação não pode ser desfeita.")) return;
            const previous = revenues;
            revenues = revenues.filter(row => row.reference !== reference);
            try { persistLocalRevenues(); load(); }
            catch (error) { revenues = previous; window.alert(error.message || "Não foi possível excluir a receita."); }
        } else if (button.dataset.revenueAction === "receive") {
            if (record.payment_status === "recebido") return;
            if (!window.confirm("Confirmar que o cliente " + record.customer_name + " pagou " + money(record.total_amount) + "? O valor será registrado como recebido no saldo financeiro.")) return;
            const previous = revenues;
            revenues = revenues.map(row => row.reference === reference ? { ...row, payment_status: "recebido", payment_date: today(), received_amount: Number(row.total_amount) || 0 } : row);
            try { persistLocalRevenues(); load(); }
            catch (error) { revenues = previous; window.alert(error.message || "Não foi possível registrar o recebimento."); }
        }
    }

    async function load() {
        const table = container.querySelector("[data-revenue-table]");
        table.innerHTML = '<div class="revenue-empty">Carregando receitas...</div>';
        revenues = readLocalRevenues();
        dashboard = calculateDashboard(revenues);
        container.querySelector("[data-kpi-billing]").textContent = money(dashboard.billing_total);
        container.querySelector("[data-kpi-received]").textContent = money(dashboard.received_total);
        container.querySelector("[data-kpi-balance]").textContent = money(dashboard.receivable_balance);
        container.querySelector("[data-kpi-overdue]").textContent = money(dashboard.overdue_balance);
        container.querySelector("[data-kpi-pending]").textContent = money(dashboard.pending_billing_total);
        filterTable();
    }

    function filterTable() {
        if (!container) return;
        const term = container.querySelector("[data-revenue-search]").value.trim().toLocaleLowerCase("pt-BR");
        const state = container.querySelector("[data-revenue-status]").value;
        const rows = revenues.filter(row => {
            const text = [row.reference,row.customer_name,row.description,row.cte_number,row.invoice_number].join(" ").toLocaleLowerCase("pt-BR");
            return (!term || text.includes(term)) && (!state || row.billing_status === state);
        });
        const table = container.querySelector("[data-revenue-table]");
        if (!rows.length) {
            table.innerHTML = '<div class="revenue-empty">Nenhuma receita encontrada. Cadastre a primeira receita ou ajuste os filtros.</div>';
            return;
        }
        table.innerHTML = '<div class="revenue-table-wrap"><table class="revenue-table"><thead><tr><th>Referência / cliente</th><th>Serviço</th><th>Data do serviço</th><th>Faturamento</th><th>Pagamento</th><th class="align-right">Valor total</th><th>Ações</th></tr></thead><tbody>' +
            rows.map(row => { const paid = row.payment_status === "recebido"; const ref = esc(row.reference); return '<tr><td><strong>' + ref + '</strong><small>' + esc(row.customer_name) + '</small></td><td>' + esc(row.description) + '<small>' + esc(row.cte_number ? "CT-e " + row.cte_number : row.operation_reference || "Sem operação vinculada") + '</small></td><td>' + dateLabel(row.service_date) + '</td><td><span class="revenue-state">' + (row.billing_status === "faturada" ? "Faturada" : "Pendente") + '</span></td><td><span class="revenue-state ' + (paid ? "paid" : "") + '">' + (paid ? "Recebido em " + dateLabel(row.payment_date) : "A receber") + '</span></td><td class="align-right"><strong>' + money(row.total_amount) + '</strong></td><td><div class="revenue-actions"><button type="button" class="revenue-btn secondary" data-revenue-action="edit" data-reference="' + ref + '">Editar</button><button type="button" class="revenue-btn danger" data-revenue-action="delete" data-reference="' + ref + '">Excluir</button><button type="button" class="revenue-btn ' + (paid ? "paid-button" : "") + '" data-revenue-action="receive" data-reference="' + ref + '" ' + (paid ? "disabled" : "") + '>' + (paid ? "Baixado" : "Baixar") + '</button></div></td></tr>'; }).join("") +
            '</tbody></table></div>';
    }

    async function save(event) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const submit = form.querySelector('[type="submit"]');
        const message = container.querySelector("[data-revenue-form-message]");
        const data = Object.fromEntries(new FormData(form));
        ["competency_date","service_date","transport_mode","operation_reference","cte_number","origin","destination","weight_kg","notes"].forEach(key => { if (!data[key]) data[key] = null; });
        ["base_amount","additions_amount","toll_amount","discount_amount"].forEach(key => { data[key] = String(Number(data[key] || 0).toFixed(2)); });
        if (data.weight_kg !== null) data.weight_kg = String(data.weight_kg);
        busy = true; submit.disabled = true; submit.textContent = "Salvando...";
        try {
            const reference = String(data.reference || "").trim().toLocaleLowerCase("pt-BR");
            if (revenues.some(row => row.reference !== editingReference && String(row.reference || "").trim().toLocaleLowerCase("pt-BR") === reference)) {
                throw new Error("Já existe uma receita com essa referência.");
            }
            const base = Number(data.base_amount) || 0;
            const additions = Number(data.additions_amount) || 0;
            const toll = Number(data.toll_amount) || 0;
            const discount = Number(data.discount_amount) || 0;
            const total = Math.round((base + additions + toll - discount) * 100) / 100;
            if (base <= 0 || total <= 0 || discount > base + additions + toll) {
                throw new Error("Confira os valores: o total da receita deve ser maior que zero.");
            }
            const existing = editingReference ? revenues.find(row => row.reference === editingReference) : null;
            const record = {
                ...(existing || {}), ...data,
                reference: String(data.reference || "").trim(),
                customer_name: String(data.customer_name || "").trim(),
                description: String(data.description || "").trim(),
                billing_status: existing ? existing.billing_status : "pendente",
                payment_status: existing ? existing.payment_status : "pendente",
                payment_date: existing ? existing.payment_date : null,
                received_amount: existing ? existing.received_amount : 0,
                total_amount: total,
                created_at: existing ? existing.created_at : new Date().toISOString(),
                updated_at: existing ? new Date().toISOString() : null
            };
            const previous = revenues;
            if (existing) revenues = revenues.map(row => row.reference === editingReference ? record : row);
            else revenues.unshift(record);
            try { persistLocalRevenues(); }
            catch (error) { revenues = previous; throw error; }
            closeForm();
            await load();
        } catch (error) {
            message.classList.add("error");
            message.textContent = error.message || "Não foi possível salvar a receita.";
        } finally {
            busy = false; submit.disabled = false; submit.textContent = "Salvar receita";
        }
    }

    window.PRIMERevenue = { render, reload: load };
})();