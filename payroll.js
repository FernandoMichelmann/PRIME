"use strict";
(() => {
    const KEY = "primePayrollV1";
    const $ = (s, root = document) => root.querySelector(s);
    const money = n => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(Number(n)||0);
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const today = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
    const monthNow = () => today().slice(0,7);
    const makeId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "pay-"+Date.now()+"-"+Math.random().toString(16).slice(2);
    const blank = () => ({employees:[],periods:[],payments:[]});
    let data = load(), host = null, tab = "resumo", month = monthNow();
    let remoteEmployees = [], apiEmployeeState = "loading", apiEmployeeError = "";
    let apiRecordsState = "loading", apiRecordsError = "";

    function load(){ try { const d=JSON.parse(localStorage.getItem(KEY)||"null"); return d && Array.isArray(d.employees)&&Array.isArray(d.periods)&&Array.isArray(d.payments)?d:blank(); } catch(e){ console.error("Falha ao carregar Folha",e); return blank(); } }
    function save(){ try { localStorage.setItem(KEY,JSON.stringify(data)); window.dispatchEvent(new CustomEvent("prime:payroll-updated")); return true; } catch(e){ console.error(e); alert("Não foi possível salvar. Verifique o armazenamento do navegador."); return false; } }
    const allEmployees = () => remoteEmployees;
    const active = () => allEmployees().filter(e=>e.status==="ativo");
    const employeeById = id => allEmployees().find(e=>e.id===id);
    function mapRemoteEmployee(e) {
        return { id:e.id, name:e.name, taxId:e.tax_id||"", type:e.employment_type||"CLT",
            role:e.role||"", department:e.department||"", costCenter:e.cost_center||"",
            startDate:e.start_date, salary:Number(e.salary||0), status:e.is_active?"ativo":"inativo",
            createdAt:e.created_at, source:"api" };
    }
    async function syncRemoteEmployees() {
        const auth = window.PRIMEAuth;
        if (!auth || !auth.getUser?.() || !auth.getCompanyId?.()) {
            apiEmployeeState = "unavailable";
            apiEmployeeError = "Entre em uma conta vinculada a uma transportadora e confirme que o backend está ativo para carregar funcionários.";
            return;
        }
        try {
            const rows = await auth.requestCompany("/payroll/employees");
            if (!Array.isArray(rows)) throw new Error("A API retornou uma resposta inesperada.");
            remoteEmployees = rows.map(mapRemoteEmployee);
            apiEmployeeState = "connected";
            apiEmployeeError = "";
        } catch (error) {
            apiEmployeeState = "error";
            apiEmployeeError = error?.message || "Não foi possível carregar os funcionários do backend.";
        }
    }
    function apiEmployeeNotice() {
        const stateText = apiEmployeeState === "connected"
            ? "Funcionários conectados ao backend."
            : "Não foi possível confirmar a conexão dos funcionários.";
        const recordsText = apiRecordsState === "connected"
            ? "Competências e pagamentos conectados ao banco de dados."
            : "Competências e pagamentos ainda não foram carregados do backend.";
        const errorText = [apiEmployeeError, apiRecordsError].filter(Boolean).join(" ");
        return '<div class="payroll-notice"><i data-lucide="database"></i><span><strong>'+esc(stateText)+'</strong> '+esc(recordsText)+' '+esc(errorText)+' Os valores trabalhistas continuam manuais e exigem validação especializada.</span></div>';
    }
    function mapRemotePeriod(p) {
        return { id:p.id, month:p.month, status:p.status, items:(p.items||[]).map(i=>({
            id:i.id, employeeId:i.employee_id, description:i.description, kind:i.kind,
            amount:Number(i.amount||0), createdAt:i.created_at||null
        })), approvedAt:p.approved_at, createdAt:p.created_at, source:"api" };
    }
    function mapRemotePayment(p) {
        return { id:p.id, month:p.month, employeeId:p.employee_id, type:p.payment_type,
            amount:Number(p.amount||0), dueDate:p.due_date, status:p.status, paidAt:p.paid_at,
            method:p.method||"", createdAt:p.created_at, source:"api" };
    }
    async function syncRemoteRecords() {
        const auth = window.PRIMEAuth;
        if (!auth || !auth.getUser?.() || !auth.getCompanyId?.()) {
            apiRecordsState = "unavailable";
            apiRecordsError = "Entre em uma conta vinculada a uma transportadora para carregar competências e pagamentos.";
            return;
        }
        try {
            const [periodRows, paymentRows] = await Promise.all([
                auth.requestCompany("/payroll/periods"),
                auth.requestCompany("/payroll/payments")
            ]);
            if (!Array.isArray(periodRows) || !Array.isArray(paymentRows)) throw new Error("A API retornou dados inesperados da folha.");
            data.periods = periodRows.map(mapRemotePeriod);
            data.payments = paymentRows.map(mapRemotePayment);
            apiRecordsState = "connected";
            apiRecordsError = "";
            window.dispatchEvent(new CustomEvent("prime:payroll-updated"));
        } catch (error) {
            apiRecordsState = "error";
            apiRecordsError = error?.message || "Não foi possível carregar competências e pagamentos do backend.";
        }
    }
    async function syncAll() {
        await Promise.all([syncRemoteEmployees(), syncRemoteRecords()]);
    }
    const period = () => data.periods.find(p=>p.month===month);
    const costOf = p => (p?.items||[]).filter(i=>i.kind!=="desconto").reduce((s,i)=>s+Math.max(0,Number(i.amount)||0),0);
    const monthCost = m => data.periods.filter(p=>p.month===m&&["aprovada","parcial","paga","fechada"].includes(p.status)).reduce((s,p)=>s+costOf(p),0);
    const paidTotal = () => data.payments.filter(p=>p.status==="pago").reduce((s,p)=>s+Number(p.amount||0),0);
    const paidInMonth = m => data.payments.filter(p=>p.status==="pago"&&String(p.paidAt||"").slice(0,7)===m).reduce((s,p)=>s+Number(p.amount||0),0);

    function render(target){ host=target; if(host) { draw(); syncAll().then(()=>{ if(host) draw(); }); } }
    function draw(){
        if(!host)return;
        const p=period(), employees=active(), pending=data.payments.filter(x=>x.status!=="pago").reduce((s,x)=>s+Number(x.amount||0),0);
        host.innerHTML =
        '<div class="expenses-page-header"><div class="eyebrow">GESTÃO FINANCEIRA / MATRIZ / FOLHA</div><h1>Folha de pagamento<span class="blue-period">.</span></h1><p>Gestão de colaboradores, competências, custos e pagamentos de pessoal.</p><button type="button" class="button-secondary" data-p-back style="margin-top:16px"><i data-lucide="arrow-left"></i> Voltar para Matriz</button></div>'+
        apiEmployeeNotice()+
        '<div class="payroll-tabs">'+[['resumo','Resumo'],['funcionarios','Funcionários'],['folha','Folha mensal'],['pagamentos','Pagamentos']].map(x=>'<button type="button" class="payroll-tab '+(tab===x[0]?'active':'')+'" data-p-tab="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+
        (tab==="resumo"?summary(employees,p,pending):"")+(tab==="funcionarios"?employeeView():"")+(tab==="folha"?periodView(p):"")+(tab==="pagamentos"?paymentView():"");
        host.querySelector("[data-p-back]")?.addEventListener("click",()=>window.PRIMEPayroll.onBack?.());
        host.querySelectorAll("[data-p-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.pTab;draw();}));
        host.querySelectorAll("[data-p-month]").forEach(i=>i.addEventListener("change",()=>{if(/^\d{4}-\d{2}$/.test(i.value))month=i.value;draw();}));
        bindForms();
        if(window.lucide)window.lucide.createIcons();
    }
    function summary(emps,p,pending){
        return '<div class="payroll-toolbar"><label>Competência <input type="month" data-p-month value="'+esc(month)+'"></label><span class="payroll-status">Status: '+esc(p?p.status:"não criada")+'</span></div>'+
        '<div class="payroll-kpis"><article class="payroll-kpi"><span>Colaboradores ativos</span><strong>'+emps.length+'</strong></article><article class="payroll-kpi"><span>Custo aprovado da competência</span><strong>'+money(monthCost(month))+'</strong></article><article class="payroll-kpi"><span>Pagamentos efetivos no mês</span><strong>'+money(paidInMonth(month))+'</strong></article><article class="payroll-kpi"><span>Pagamentos pendentes</span><strong>'+money(pending)+'</strong></article></div>'+
        '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Visão geral</h2><p>Indicadores calculados a partir dos registros persistidos no banco de dados.</p></div><button type="button" class="button-primary" data-p-tab="funcionarios">Cadastrar funcionário</button></div><div class="payroll-empty">'+(emps.length?emps.length+" colaborador(es) ativo(s). A folha "+(p?"está em "+esc(p.status):"ainda não foi criada")+".":"Nenhum funcionário cadastrado. Comece pelo cadastro de colaboradores e prestadores.")+'</div></div>'+
        '<div class="payroll-panel"><h2>Limites desta versão</h2><p class="payroll-muted">Rubricas manuais não equivalem a cálculo oficial. INSS, IRRF, FGTS, férias, décimo terceiro, rescisões, permissões e backend seguro ainda precisam de implementação e validação especializada.</p></div>';
    }
    function employeeView(){
        return '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Novo colaborador</h2><p>Novos cadastros são enviados à API autenticada da transportadora. Não informe dados bancários nesta etapa.</p></div></div>'+
        '<form class="payroll-form" id="p-employee"><label>Nome completo<input name="name" required maxlength="140"></label><label>CPF/CNPJ (opcional)<input name="taxId" maxlength="24"></label><label>Vínculo<select name="type"><option>CLT</option><option>PJ</option><option value="outro">Outro</option></select></label><label>Cargo/função<input name="role" maxlength="100"></label><label>Setor<input name="department" maxlength="100"></label><label>Centro de custo<input name="costCenter" maxlength="100"></label><label>Início do vínculo<input type="date" name="startDate" required value="'+today()+'"></label><label>Remuneração mensal (R$)<input type="number" name="salary" min="0" step="0.01" required value="0"></label><label>Situação<select name="status"><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label><div class="payroll-form-actions"><button class="button-primary" type="submit">Salvar funcionário</button></div></form></div>'+
        '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Colaboradores cadastrados</h2><p>'+allEmployees().length+' registro(s), incluindo inativos.</p></div></div>'+
        (allEmployees().length?'<div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>Nome</th><th>Vínculo</th><th>Função/setor</th><th>Remuneração</th><th>Situação</th><th>Origem</th><th></th></tr></thead><tbody>'+allEmployees().map(e=>'<tr><td><strong>'+esc(e.name)+'</strong><small>'+esc(e.taxId||"Documento não informado")+'</small></td><td>'+esc(e.type)+'</td><td>'+esc(e.role||"—")+'<small>'+esc(e.department||"—")+'</small></td><td>'+money(e.salary)+'</td><td>'+esc(e.status)+'</td><td>'+((e.source==="api")?"Backend":"Local (legado)")+'</td><td><button type="button" class="button-secondary payroll-small-button" '+(e.source==="api"?'data-p-api-toggle="'+esc(e.id)+'"':'data-p-toggle="'+esc(e.id)+'"')+'>'+(e.status==="ativo"?"Inativar":"Reativar")+'</button></td></tr>').join('')+'</tbody></table></div>':'<div class="payroll-empty">Nenhum colaborador cadastrado.</div>')+'</div>';
    }
    function periodView(p){
        if(!p)return '<div class="payroll-toolbar"><label>Competência <input type="month" data-p-month value="'+esc(month)+'"></label></div><div class="payroll-panel"><h2>Preparar competência</h2><p class="payroll-muted">Adicione rubricas manuais. Nenhuma alíquota legal será presumida.</p><button type="button" class="button-primary" data-p-create>Criar folha da competência</button></div>';
        const approved=["aprovada","parcial","paga","fechada"].includes(p.status);
        return '<div class="payroll-toolbar"><label>Competência <input type="month" data-p-month value="'+esc(month)+'"></label><span class="payroll-status">Status: '+esc(p.status)+'</span></div><div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Folha '+esc(month)+'</h2><p>Rubricas manuais com origem rastreável.</p></div><strong class="payroll-period-total">'+money(costOf(p))+'</strong></div>'+
        (p.items.length?'<div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>Funcionário</th><th>Rubrica</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>'+p.items.map(i=>'<tr><td>'+esc(employeeById(i.employeeId)?.name||"Colaborador removido")+'</td><td>'+esc(i.description)+'</td><td>'+esc(i.kind)+'</td><td>'+money(i.amount)+'</td><td>'+(approved?'—':'<button type="button" class="button-secondary payroll-small-button" data-p-remove="'+esc(i.id)+'">Excluir</button>')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="payroll-empty">Nenhuma rubrica cadastrada.</div>')+
        (!approved?'<form class="payroll-form" id="p-item"><label>Funcionário<select name="employeeId" required>'+active().map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select></label><label>Descrição<input name="description" required maxlength="120" placeholder="Salário, comissão, benefício..."></label><label>Tipo<select name="kind"><option value="provento/custo">Provento/custo</option><option value="desconto">Desconto</option></select></label><label>Valor (R$)<input type="number" name="amount" min="0.01" step="0.01" required></label><div class="payroll-form-actions"><button class="button-primary" type="submit" '+(active().length?'':'disabled')+'>Adicionar rubrica</button></div></form><div class="payroll-actions"><button type="button" class="button-primary" data-p-approve>Aprovar valores manuais</button></div>':'<p class="payroll-muted">Competência aprovada. Reabertura controlada será implementada em etapa posterior.</p>')+'</div>';
    }
    function paymentView(){
        return '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Registrar pagamento</h2><p>Adiantamento, saldo salarial ou outro pagamento. Só marque como pago após a saída efetiva do dinheiro.</p></div></div><form class="payroll-form" id="p-payment"><label>Competência<input type="month" name="month" required value="'+esc(month)+'"></label><label>Funcionário<select name="employeeId" required>'+active().map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select></label><label>Tipo<select name="type"><option value="adiantamento">Adiantamento (dia 20)</option><option value="saldo">Saldo salarial (5º dia útil)</option><option value="outro">Outro</option></select></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Vencimento<input name="dueDate" type="date" required></label><label>Situação<select name="status"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label><label>Data efetiva<input name="paidAt" type="date" value="'+today()+'"></label><label>Método<input name="method" maxlength="60" placeholder="PIX, transferência..."></label><div class="payroll-form-actions"><button class="button-primary" type="submit" '+(active().length?'':'disabled')+'>Registrar pagamento</button></div></form></div>'+
        '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Histórico de pagamentos</h2><p>'+data.payments.length+' registro(s). Pagamentos não são apagados ao reprocessar folhas.</p></div></div>'+
        (data.payments.length?'<div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>Competência</th><th>Funcionário</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>'+[...data.payments].sort((a,b)=>(b.dueDate||"").localeCompare(a.dueDate||"")).map(p=>'<tr><td>'+esc(p.month)+'</td><td>'+esc(employeeById(p.employeeId)?.name||"Colaborador")+'</td><td>'+esc(p.type)+'</td><td>'+esc(p.dueDate)+'</td><td>'+money(p.amount)+'</td><td>'+esc(p.status)+(p.status!=="pago"?' <button type="button" class="button-secondary payroll-small-button" data-p-paid="'+esc(p.id)+'">Marcar pago</button>':' <button type="button" class="button-secondary payroll-small-button" data-p-reverse="'+esc(p.id)+'">Estornar</button>')+' <button type="button" class="button-secondary payroll-small-button" data-p-edit="'+esc(p.id)+'">Editar</button> <button type="button" class="button-secondary payroll-small-button" data-p-delete="'+esc(p.id)+'">Excluir</button></td></tr>').join('')+'</tbody></table></div>':'<div class="payroll-empty">Nenhum pagamento registrado.</div>')+'</div>';
    }
    function bindForms(){
        $("#p-employee",host)?.addEventListener("submit", async e=>{
            e.preventDefault();
            const form=e.currentTarget, submit=form.querySelector('button[type="submit"]'), f=new FormData(form);
            const name=String(f.get("name")||"").trim();
            if(!name || !window.PRIMEAuth) return;
            if(submit){submit.disabled=true;submit.textContent="Salvando...";}
            const payload={
                name, tax_id:String(f.get("taxId")||"").trim()||null,
                employment_type:String(f.get("type")||"CLT"), role:String(f.get("role")||"").trim()||null,
                department:String(f.get("department")||"").trim()||null, cost_center:String(f.get("costCenter")||"").trim()||null,
                start_date:String(f.get("startDate")), salary:Number(f.get("salary")||0),
                is_active:String(f.get("status")||"ativo")==="ativo"
            };
            try{
                await window.PRIMEAuth.requestCompany("/payroll/employees",{method:"POST",body:JSON.stringify(payload)});
                await syncAll(); form.reset(); draw();
            }catch(error){alert(error.message||"Não foi possível salvar o funcionário no backend.");}
            finally{if(submit){submit.disabled=false;submit.textContent="Salvar funcionário";}}
        });
        host.querySelectorAll("[data-p-api-toggle]").forEach(b=>b.addEventListener("click",async()=>{
            const employee=remoteEmployees.find(x=>x.id===b.dataset.pApiToggle); if(!employee||!window.PRIMEAuth)return;
            const next=employee.status!=="ativo";
            if(!confirm((next?"Reativar":"Inativar")+" este funcionário no backend?"))return;
            b.disabled=true;
            try{await window.PRIMEAuth.requestCompany("/payroll/employees/"+encodeURIComponent(employee.id)+"/status?is_active="+String(next),{method:"PATCH"});await syncAll();draw();}
            catch(error){alert(error.message||"Falha ao atualizar funcionário.");b.disabled=false;}
        }));
        host.querySelector("[data-p-create]")?.addEventListener("click",async()=>{
            if(period())return;
            if(!window.PRIMEAuth)return;
            try{
                await window.PRIMEAuth.requestCompany("/payroll/periods",{method:"POST",body:JSON.stringify({month,status:"preparação",items:[]})});
                await syncRemoteRecords();draw();
            }catch(error){alert(error.message||"Não foi possível criar a competência no banco de dados.");}
        });
        $("#p-item",host)?.addEventListener("submit",async e=>{
            e.preventDefault();const current=period();if(!current||!active().length||!window.PRIMEAuth)return;
            const form=e.currentTarget,f=new FormData(form), amount=Number(f.get("amount")||0);
            const item={id:makeId(),employee_id:String(f.get("employeeId")),description:String(f.get("description")||"").trim(),kind:String(f.get("kind")),amount,created_at:new Date().toISOString()};
            const items=[...current.items,item];
            const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Salvando...";}
            try{
                await window.PRIMEAuth.requestCompany("/payroll/periods/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({items})});
                await syncRemoteRecords();draw();
            }catch(error){alert(error.message||"Não foi possível salvar a rubrica.");}
            finally{if(submit){submit.disabled=false;submit.textContent="Adicionar rubrica";}}
        });
        host.querySelectorAll("[data-p-remove]").forEach(b=>b.addEventListener("click",async()=>{
            const current=period();if(!current||!confirm("Excluir esta rubrica da competência em preparação?")||!window.PRIMEAuth)return;
            try{
                const items=current.items.filter(i=>i.id!==b.dataset.pRemove).map(i=>({id:i.id,employee_id:i.employeeId,description:i.description,kind:i.kind,amount:i.amount,created_at:i.createdAt||null}));
                await window.PRIMEAuth.requestCompany("/payroll/periods/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({items})});
                await syncRemoteRecords();draw();
            }catch(error){alert(error.message||"Não foi possível excluir a rubrica.");}
        }));
        host.querySelector("[data-p-approve]")?.addEventListener("click",async()=>{
            const current=period();if(!current||!current.items.length){alert("Adicione uma rubrica antes de aprovar.");return;}
            if(!confirm("Aprovar os valores manuais? Isso incluirá o custo no dashboard, mas não representa validação contábil ou legal.")||!window.PRIMEAuth)return;
            try{
                await window.PRIMEAuth.requestCompany("/payroll/periods/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({status:"aprovada",approved_at:new Date().toISOString()})});
                await syncRemoteRecords();draw();
            }catch(error){alert(error.message||"Não foi possível aprovar a competência.");}
        });
        $("#p-payment",host)?.addEventListener("submit",async e=>{
            e.preventDefault();const form=e.currentTarget,f=new FormData(form),amount=Number(f.get("amount")||0);
            if(!(amount>0)||!active().length||!window.PRIMEAuth)return;
            const status=String(f.get("status")), paidAt=status==="pago"?String(f.get("paidAt")||today()):null;
            const payload={month:String(f.get("month")),employee_id:String(f.get("employeeId")),payment_type:String(f.get("type")),amount,due_date:String(f.get("dueDate")),status,paid_at:paidAt,method:String(f.get("method")||"").trim()||null};
            const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Salvando...";}
            try{
                await window.PRIMEAuth.requestCompany("/payroll/payments",{method:"POST",body:JSON.stringify(payload)});
                await syncRemoteRecords();draw();
            }catch(error){alert(error.message||"Não foi possível registrar o pagamento no backend.");}
            finally{if(submit){submit.disabled=false;submit.textContent="Registrar pagamento";}}
        });
        host.querySelectorAll("[data-p-paid]").forEach(b=>b.addEventListener("click",async()=>{
            if(!confirm("Confirmar que o pagamento foi efetivamente realizado?")||!window.PRIMEAuth)return;
            try{
                await window.PRIMEAuth.requestCompany("/payroll/payments/"+encodeURIComponent(b.dataset.pPaid),{method:"PATCH",body:JSON.stringify({status:"pago",paid_at:today()})});
                await syncRemoteRecords();draw();
            }catch(error){alert(error.message||"Não foi possível atualizar o pagamento.");}
        }));
        host.querySelectorAll("[data-p-edit]").forEach(b=>b.addEventListener("click",async()=>{
            const p=data.payments.find(item=>String(item.id)===String(b.dataset.pEdit));
            if(!p||!window.PRIMEAuth)return;
            const month=prompt("Competência (AAAA-MM):",p.month||"");if(month===null)return;
            const type=prompt("Tipo de pagamento:",p.type||"outro");if(type===null)return;
            const amountText=prompt("Valor (R$):",String(p.amount??""));if(amountText===null)return;
            const dueDate=prompt("Data de vencimento (AAAA-MM-DD):",p.dueDate||"");if(dueDate===null)return;
            const status=prompt("Status (pendente ou pago):",p.status||"pendente");if(status===null)return;
            if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim())){alert("Competência inválida. Use AAAA-MM.");return;}
            if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())){alert("Data inválida. Use AAAA-MM-DD.");return;}
            const amount=Number(amountText.replace(",","."));if(!(amount>0)){alert("Informe um valor maior que zero.");return;}
            if(!["pendente","pago"].includes(status.trim())){alert("Status deve ser pendente ou pago.");return;}
            let paidAt=null;
            if(status.trim()==="pago"){
                paidAt=prompt("Data efetiva do pagamento (AAAA-MM-DD):",p.paidAt||today());if(paidAt===null)return;
                if(!/^\d{4}-\d{2}-\d{2}$/.test(paidAt.trim())){alert("Data efetiva inválida.");return;}
            }
            const method=prompt("Método de pagamento (PIX, transferência etc.):",p.method||"");if(method===null)return;
            try{
                await window.PRIMEAuth.requestCompany("/payroll/payments/"+encodeURIComponent(p.id),{method:"PATCH",body:JSON.stringify({month:month.trim(),payment_type:type.trim()||"outro",amount,due_date:dueDate.trim(),status:status.trim(),paid_at:paidAt,method:method.trim()||null})});
                await syncRemoteRecords();draw();
                alert("Pagamento atualizado. O Dashboard foi recalculado.");
            }catch(error){alert(error.message||"Não foi possível editar o pagamento.");}
        }));
        host.querySelectorAll("[data-p-reverse]").forEach(b=>b.addEventListener("click",async()=>{
            if(!confirm("Estornar este pagamento? Ele voltará para Pendente e o Dashboard será recalculado.")||!window.PRIMEAuth)return;
            try{
                await window.PRIMEAuth.requestCompany("/payroll/payments/"+encodeURIComponent(b.dataset.pReverse),{method:"PATCH",body:JSON.stringify({status:"pendente",paid_at:null})});
                await syncRemoteRecords();draw();
                alert("Pagamento estornado. O Dashboard foi atualizado.");
            }catch(error){alert(error.message||"Não foi possível estornar o pagamento.");}
        }));
        host.querySelectorAll("[data-p-delete]").forEach(b=>b.addEventListener("click",async()=>{
            if(!confirm("Excluir permanentemente este pagamento? A ação será registrada na auditoria e não poderá ser desfeita.")||!window.PRIMEAuth)return;
            try{
                await window.PRIMEAuth.requestCompany("/payroll/payments/"+encodeURIComponent(b.dataset.pDelete),{method:"DELETE"});
                await syncRemoteRecords();draw();
                alert("Pagamento excluído. O Dashboard foi atualizado.");
            }catch(error){alert(error.message||"Não foi possível excluir o pagamento.");}
        }));
    }
    window.PRIMEPayroll={
        render,
        getCompetencyCost:monthCost,
        getPaidPaymentsTotal:paidTotal,
        getPaidPaymentsInMonth:paidInMonth,
        getPaidPaymentsThroughDate:(dateLimit)=>data.payments.filter(p=>{const paidDate=String(p.paidAt||p.dueDate||"").slice(0,10);return p.status==="pago"&&Boolean(paidDate)&&paidDate<=dateLimit;}).reduce((s,p)=>s+Number(p.amount||0),0),
        getPendingPaymentsForDate:(date)=>data.payments.filter(p=>p.status!=="pago"&&String(p.dueDate||"").slice(0,10)===date).reduce((s,p)=>s+Number(p.amount||0),0),
        getPendingPaymentsTotal:(monthLimit)=>data.payments.filter(p=>p.status!=="pago"&&(!monthLimit||((p.dueDate&&String(p.dueDate).slice(0,7)<=monthLimit)||(!p.dueDate&&String(p.month||"")<=monthLimit)))).reduce((s,p)=>s+Number(p.amount||0),0),
        onBack:null
    };
})();