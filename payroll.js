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
    let data = load(), host = null, tab = "resumo", month = monthNow(), editingEmployeeId = null;
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
            phone:e.phone||"", address:e.address||"", addressNumber:e.address_number||"",
            postalCode:e.postal_code||"", city:e.city||"", state:e.state||"",
            maritalStatus:e.marital_status||"", startDate:e.start_date||"", contractEndDate:e.contract_end_date||"",
            salary:Number(e.salary||0), salarySplit:Boolean(e.salary_split),
            salaryDay5Amount:Number(e.salary_day5_amount||0), salaryDay20Amount:Number(e.salary_day20_amount||0),
            integralPaymentDay:e.integral_payment_day||"", status:e.is_active?"ativo":"inativo",
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
            amount:Number(i.amount||0), createdAt:i.created_at||null, dueDate:i.due_date||null,
            source:i.source||"manual", approved:Boolean(i.approved), paymentId:i.payment_id||null,
            extraCategory:i.extra_category||null
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
    const monthCost = m => data.periods.filter(p=>p.month===m).reduce((s,p)=>s+costOf(p),0);
    const paidTotal = () => data.payments.filter(p=>p.status==="pago").reduce((s,p)=>s+Number(p.amount||0),0);
    const paidInMonth = m => data.payments.filter(p=>p.status==="pago"&&String(p.paidAt||"").slice(0,7)===m).reduce((s,p)=>s+Number(p.amount||0),0);

    const businessDay = d => d.getDay()!==0 && d.getDay()!==6;
    const isoDate = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    function fifthBusinessDay(y,m){const d=new Date(y,m,1);let n=0;while(d.getMonth()===m){if(businessDay(d)&&++n===5)return isoDate(d);d.setDate(d.getDate()+1);}return isoDate(new Date(y,m+1,0));}
    function dueDateFor(employee, cycle, periodMonth=month){
        const [y,mm]=periodMonth.split("-").map(Number),m=mm-1;
        if(cycle==="5o_dia_util")return fifthBusinessDay(y,m);
        if(cycle==="dia_20")return isoDate(new Date(y,m,20));
        if(cycle==="ultimo_dia_util"){const d=new Date(y,m+1,0);while(!businessDay(d))d.setDate(d.getDate()-1);return isoDate(d);}
        if(cycle==="dia_30")return isoDate(new Date(y,m,30));
        const match=String(employee.integralPaymentDay||"").match(/(?:dia\\s*)?(\\d{1,2})/i);
        return match?isoDate(new Date(y,m,Math.min(Number(match[1]),new Date(y,m+1,0).getDate()))):isoDate(new Date(y,m,20));
    }
    async function ensureAutomaticPayroll(){
        if(apiEmployeeState!=="connected"||apiRecordsState!=="connected"||!window.PRIMEAuth)return;
        let current=period();
        if(!current){
            try{await window.PRIMEAuth.requestCompany("/payroll/periods",{method:"POST",body:JSON.stringify({month,status:"preparação",items:[]})});await syncRemoteRecords();current=period();}
            catch(error){apiRecordsError=error?.message||"Não foi possível criar a competência automática.";return;}
        }
        if(!current||current.status!=="preparação")return;
        const [y,mm]=month.split("-").map(Number),start=month+"-01",end=isoDate(new Date(y,mm,0)),newItems=[];
        for(const employee of active()){
            if((employee.startDate&&employee.startDate>end)||(employee.contractEndDate&&employee.contractEndDate<start))continue;
            const cycles=employee.salarySplit?[["5o_dia_util",Number(employee.salaryDay5Amount||0)],["dia_20",Number(employee.salaryDay20Amount||0)]]:[[employee.integralPaymentDay||"5o_dia_util",Number(employee.salary||0)]];
            for(const [cycle,amount] of cycles){
                const description=cycle==="5o_dia_util"?"Salário — 5º dia útil":cycle==="dia_20"?"Salário — dia 20":"Salário integral";
                if(amount>0&&!(current.items||[]).some(i=>i.employeeId===employee.id&&i.description===description&&i.source==="salary_auto"))
                    newItems.push({id:makeId(),employee_id:employee.id,description,kind:"provento/custo",amount,created_at:new Date().toISOString(),due_date:dueDateFor(employee,cycle),source:"salary_auto",approved:false,payment_id:null,extra_category:null});
            }
        }
        if(newItems.length){
            const items=[...(current.items||[]).map(i=>({id:i.id,employee_id:i.employeeId,description:i.description,kind:i.kind,amount:i.amount,created_at:i.createdAt||null,due_date:i.dueDate||null,source:i.source||"manual",approved:Boolean(i.approved),payment_id:i.paymentId||null,extra_category:i.extraCategory||null})),...newItems];
            try{await window.PRIMEAuth.requestCompany("/payroll/periods/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({items})});await syncRemoteRecords();}
            catch(error){apiRecordsError=error?.message||"Não foi possível gerar as parcelas automáticas.";}
        }
    }
    function render(target){ host=target; if(host) { draw(); syncAll().then(()=>ensureAutomaticPayroll()).then(()=>{ if(host) draw(); }); } }
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
        host.querySelectorAll("[data-p-month]").forEach(i=>i.addEventListener("change",async()=>{if(/^\d{4}-\d{2}$/.test(i.value))month=i.value;await syncAll();await ensureAutomaticPayroll();draw();}));
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
        const editingEmployee = editingEmployeeId ? allEmployees().find(e=>String(e.id)===String(editingEmployeeId)) : null;
        const selected = (actual, expected) => String(actual ?? "") === String(expected ?? "") ? " selected" : "";
        const split = Boolean(editingEmployee?.salarySplit);
        const storedIntegralDay = editingEmployee?.integralPaymentDay || "";
        const knownIntegralDays = ["5o_dia_util","dia_20","ultimo_dia_util","dia_30"];
        const integralDay = knownIntegralDays.includes(storedIntegralDay) ? storedIntegralDay : (storedIntegralDay ? "outro" : "5o_dia_util");
        const integralDayOther = storedIntegralDay && !knownIntegralDays.includes(storedIntegralDay) ? storedIntegralDay : "";
        return '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>'+(editingEmployee?'Editar colaborador':'Novo colaborador')+'</h2><p>'+(editingEmployee?'Atualize os dados do cadastro existente. O histórico da folha e dos pagamentos será preservado.':'Preencha os dados pessoais, contratuais e a programação de pagamento do colaborador.')+'</p></div></div>'+
        '<form class="payroll-form" id="p-employee">'+
        '<label>Nome completo<input name="name" required maxlength="180" value="'+esc(editingEmployee?.name||"")+'"></label>'+
        '<label>CPF ou CNPJ<input name="taxId" maxlength="20" value="'+esc(editingEmployee?.taxId||"")+'" placeholder="Digite CPF ou CNPJ"></label>'+
        '<label>Telefone<input name="phone" maxlength="30" value="'+esc(editingEmployee?.phone||"")+'" placeholder="(00) 00000-0000"></label>'+
        '<label>Estado civil<select name="maritalStatus"><option value="">Selecione</option><option value="solteiro"'+selected(editingEmployee?.maritalStatus,"solteiro")+'>Solteiro(a)</option><option value="casado"'+selected(editingEmployee?.maritalStatus,"casado")+'>Casado(a)</option><option value="viuvo"'+selected(editingEmployee?.maritalStatus,"viuvo")+'>Viúvo(a)</option><option value="divorciado"'+selected(editingEmployee?.maritalStatus,"divorciado")+'>Divorciado(a)</option><option value="separado"'+selected(editingEmployee?.maritalStatus,"separado")+'>Separado(a)</option></select></label>'+
        '<label>Endereço<input name="address" maxlength="180" value="'+esc(editingEmployee?.address||"")+'" placeholder="Rua, avenida, etc."></label>'+
        '<label>Número do endereço<input name="addressNumber" maxlength="30" value="'+esc(editingEmployee?.addressNumber||"")+'"></label>'+
        '<label>CEP<input name="postalCode" maxlength="9" value="'+esc(editingEmployee?.postalCode||"")+'" placeholder="00000-000"></label>'+
        '<label>Cidade<input name="city" maxlength="100" value="'+esc(editingEmployee?.city||"")+'"></label>'+
        '<label>Estado (UF)<input name="state" maxlength="2" value="'+esc(editingEmployee?.state||"")+'" placeholder="PR"></label>'+
        '<label>Cargo<input name="role" maxlength="120" value="'+esc(editingEmployee?.role||"")+'"></label>'+
        '<label>Setor<input name="department" maxlength="100" value="'+esc(editingEmployee?.department||"")+'"></label>'+
        '<label>Centro de custo<input name="costCenter" maxlength="100" value="'+esc(editingEmployee?.costCenter||"")+'"></label>'+
        '<label>Vínculo<select name="type"><option value="CLT"'+selected(editingEmployee?.type,"CLT")+'>CLT</option><option value="PJ"'+selected(editingEmployee?.type,"PJ")+'>PJ</option><option value="Temporário"'+selected(editingEmployee?.type,"Temporário")+'>Temporário</option><option value="Estágio"'+selected(editingEmployee?.type,"Estágio")+'>Estágio</option><option value="Outro"'+selected(editingEmployee?.type,"Outro")+'>Outro</option></select></label>'+
        '<label>Início do contrato<input type="date" name="startDate" required value="'+esc(editingEmployee?.startDate||today())+'"></label>'+
        '<label>Fim do contrato (se dispensado)<input type="date" name="contractEndDate" value="'+esc(editingEmployee?.contractEndDate||"")+'"></label>'+
        '<label>Remuneração mensal (R$)<input type="number" name="salary" min="0" step="0.01" required value="'+esc(editingEmployee ? editingEmployee.salary : 0)+'"></label>'+
        '<label>Dividir o salário em 5º dia útil e dia 20?<select name="salarySplit"><option value="nao"'+selected(split,false)+'>Não — pagamento integral</option><option value="sim"'+selected(split,true)+'>Sim — dividir em duas parcelas</option></select></label>'+
        '<div data-salary-split-fields style="'+(split?"":"display:none;")+'"><label>Valor pago no 5º dia útil (R$)<input type="number" name="salaryDay5Amount" min="0" step="0.01" value="'+esc(editingEmployee?.salaryDay5Amount??0)+'"></label><label>Valor pago no dia 20 (R$)<input type="number" name="salaryDay20Amount" min="0" step="0.01" value="'+esc(editingEmployee?.salaryDay20Amount??0)+'"></label><p class="payroll-muted">A soma das duas parcelas deve ser igual à remuneração mensal.</p></div>'+
        '<div data-integral-payment-fields style="'+(split?"display:none;":"")+'"><label>Quando será pago o salário integral?<select name="integralPaymentDay"><option value="5o_dia_util"'+selected(integralDay,"5o_dia_util")+'>5º dia útil</option><option value="dia_20"'+selected(integralDay,"dia_20")+'>Dia 20</option><option value="ultimo_dia_util"'+selected(integralDay,"ultimo_dia_util")+'>Último dia útil do mês</option><option value="dia_30"'+selected(integralDay,"dia_30")+'>Dia 30</option><option value="outro"'+selected(integralDay,"outro")+'>Outro dia</option></select></label><label data-integral-other-field style="'+(integralDay==="outro"?"":"display:none;")+'">Informe o dia ou regra de pagamento<input name="integralPaymentDayOther" maxlength="40" value="'+esc(integralDayOther)+'" placeholder="Ex.: todo dia 10"></label></div>'+
        '<label>Situação do cadastro<select name="status"><option value="ativo"'+selected(editingEmployee?.status,"ativo")+'>Ativo</option><option value="inativo"'+selected(editingEmployee?.status,"inativo")+'>Inativo</option></select></label>'+
        '<div class="payroll-form-actions"><button class="button-primary" type="submit">'+(editingEmployee?'Salvar alterações':'Salvar funcionário')+'</button>'+(editingEmployee?'<button class="button-secondary" type="button" data-p-employee-cancel>Cancelar</button>':'')+'</div></form></div>'+
        '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Colaboradores cadastrados</h2><p>'+allEmployees().length+' registro(s), incluindo inativos.</p></div></div>'+
        (allEmployees().length?'<div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>Nome</th><th>Vínculo</th><th>Função/setor</th><th>Remuneração</th><th>Pagamento</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+allEmployees().map(e=>'<tr><td><strong>'+esc(e.name)+'</strong><small>'+esc(e.taxId||"Documento não informado")+'</small><small>'+esc(e.phone||"Telefone não informado")+'</small></td><td>'+esc(e.type)+'</td><td>'+esc(e.role||"—")+'<small>'+esc(e.department||"—")+'</small></td><td>'+money(e.salary)+'</td><td>'+esc(e.salarySplit?("5º útil: "+money(e.salaryDay5Amount)+" / Dia 20: "+money(e.salaryDay20Amount)):(e.integralPaymentDay==="5o_dia_util"?"5º dia útil":e.integralPaymentDay==="dia_20"?"Dia 20":e.integralPaymentDay==="ultimo_dia_util"?"Último dia útil":e.integralPaymentDay==="dia_30"?"Dia 30":e.integralPaymentDay||"Não definido"))+'</td><td>'+esc(e.status)+'</td><td style="min-width:190px;white-space:normal"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button type="button" class="button-secondary payroll-small-button" data-p-employee-edit="'+esc(e.id)+'">Editar</button><button type="button" class="button-secondary payroll-small-button" '+(e.source==="api"?'data-p-api-toggle="'+esc(e.id)+'"':'data-p-toggle="'+esc(e.id)+'"')+'>'+(e.status==="ativo"?"Inativar":"Reativar")+'</button></div></td></tr>').join('')+'</tbody></table></div>':'<div class="payroll-empty">Nenhum colaborador cadastrado.</div>')+'</div>';
    }
    function periodView(p){
        if(!p)return '<div class="payroll-toolbar"><label>Competência <input type="month" data-p-month value="'+esc(month)+'"></label></div><div class="payroll-panel"><h2>Preparando folha automática</h2><p class="payroll-muted">A competência será criada com as parcelas salariais dos funcionários ativos.</p></div>';
        const currentDay=Number(today().slice(8,10)),cycle=currentDay<10?"5o_dia_util":"dia_20";
        const dueItems=(p.items||[]).filter(i=>{
            if(i.source==="salary_auto")return cycle==="5o_dia_util"?i.description==="Salário — 5º dia útil"||i.description==="Salário integral"&&String(i.dueDate||"").slice(8,10)<="10":i.description==="Salário — dia 20"||i.description==="Salário integral"&&String(i.dueDate||"").slice(8,10)>="10";
            return !i.dueDate||String(i.dueDate).slice(0,7)===month;
        });
        const approved=["aprovada","parcial","paga","fechada"].includes(p.status);
        return '<div class="payroll-toolbar"><label>Competência <input type="month" data-p-month value="'+esc(month)+'"></label><span class="payroll-status">Ciclo atual: '+(currentDay<10?"5º dia útil":"Dia 20")+'</span><span class="payroll-status">Status: '+esc(p.status)+'</span></div><div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Folha '+esc(month)+'</h2><p>Custos previstos entram no resumo financeiro mesmo antes da aprovação.</p></div><strong class="payroll-period-total">'+money(costOf(p))+'</strong></div>'+
        (dueItems.length?'<div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>Funcionário</th><th>Rubrica</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+dueItems.map(i=>{
            const employee=employeeById(i.employeeId),sent=Boolean(i.paymentId)||Boolean(i.approved);
            return '<tr><td><strong>'+esc(employee?.name||"Colaborador")+'</strong><small>'+esc(employee?.role||employee?.department||"")+'</small></td><td>'+esc(i.description)+(i.extraCategory?'<small>'+esc(i.extraCategory)+'</small>':"")+'</td><td>'+esc(i.dueDate||month+"-20")+'</td><td>'+money(i.amount)+'</td><td>'+(sent?"Enviado para pagamento":"Previsto — não aprovado")+'</td><td><div style="display:flex;gap:6px;flex-wrap:wrap">'+(!sent?'<button type="button" class="button-secondary payroll-small-button" data-p-extra-toggle="'+esc(i.id)+'">Adicionar custo extra</button><button type="button" class="button-primary payroll-small-button" data-p-send="'+esc(i.id)+'">Aprovar e enviar para pagamento</button>':'—')+'</div></td></tr>'+
            (!sent?'<tr><td colspan="6"><form class="payroll-form" data-p-extra-form="'+esc(i.id)+'" style="display:none;padding:12px"><label>Tipo de custo<select name="category" required><option value="VR">VR</option><option value="VA">VA</option><option value="AUX MERCADO">Auxílio mercado</option><option value="AUX FARMÁCIA">Auxílio farmácia</option><option value="OUTROS">Outros</option></select></label><label>Valor extra (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label data-extra-description-wrap style="display:none">Descreva o custo<input name="description" maxlength="120" placeholder="Descreva o custo"></label><div class="payroll-form-actions"><button type="submit" class="button-primary">Adicionar custo extra</button></div></form></td></tr>':"");
        }).join("")+'</tbody></table></div>':'<div class="payroll-empty">Nenhum funcionário tem parcela prevista neste ciclo.</div>')+
        (!approved?'<form class="payroll-form" id="p-item"><label>Funcionário<select name="employeeId" required>'+active().map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select></label><label>Descrição<input name="description" required maxlength="120" placeholder="Comissão, benefício ou outro custo"></label><label>Tipo<select name="kind"><option value="provento/custo">Provento/custo</option><option value="desconto">Desconto</option></select></label><label>Valor (R$)<input type="number" name="amount" min="0.01" step="0.01" required></label><div class="payroll-form-actions"><button class="button-primary" type="submit" '+(active().length?'':'disabled')+'>Adicionar rubrica manual</button></div></form>':'<p class="payroll-muted">Competência encerrada para inclusão de rubricas.</p>')+'</div>';
    }
    function paymentView(){
        return '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Registrar pagamento</h2><p>Adiantamento, saldo salarial ou outro pagamento. Só marque como pago após a saída efetiva do dinheiro.</p></div></div><form class="payroll-form" id="p-payment"><label>Competência<input type="month" name="month" required value="'+esc(month)+'"></label><label>Funcionário<select name="employeeId" required>'+active().map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select></label><label>Tipo<select name="type"><option value="adiantamento">Adiantamento (dia 20)</option><option value="saldo">Saldo salarial (5º dia útil)</option><option value="outro">Outro</option></select></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Vencimento<input name="dueDate" type="date" required></label><label>Situação<select name="status"><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label><label>Data efetiva<input name="paidAt" type="date" value="'+today()+'"></label><label>Método<input name="method" maxlength="60" placeholder="PIX, transferência..."></label><div class="payroll-form-actions"><button class="button-primary" type="submit" '+(active().length?'':'disabled')+'>Registrar pagamento</button></div></form></div>'+
        '<div class="payroll-panel"><div class="payroll-panel-heading"><div><h2>Histórico de pagamentos</h2><p>'+data.payments.length+' registro(s). Pagamentos não são apagados ao reprocessar folhas.</p></div></div>'+
        (data.payments.length?'<div class="payroll-table-wrap"><table class="payroll-table"><thead><tr><th>Competência</th><th>Funcionário</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+[...data.payments].sort((a,b)=>(b.dueDate||"").localeCompare(a.dueDate||"")).map(p=>'<tr><td>'+esc(p.month)+'</td><td>'+esc(employeeById(p.employeeId)?.name||"Colaborador")+'</td><td>'+esc(p.type)+'</td><td>'+esc(p.dueDate)+'</td><td>'+money(p.amount)+'</td><td>'+esc(p.status)+'</td><td style="min-width:220px;white-space:normal"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +(p.status!=="pago"?'<button type="button" class="button-secondary payroll-small-button" data-p-paid="'+esc(p.id)+'">Marcar pago</button>':'<button type="button" class="button-secondary payroll-small-button" data-p-reverse="'+esc(p.id)+'">Estornar</button>')+'<button type="button" class="button-secondary payroll-small-button" data-p-edit="'+esc(p.id)+'">Editar</button><button type="button" class="button-secondary payroll-small-button" data-p-delete="'+esc(p.id)+'">Excluir</button></div></td></tr>').join('')+'</tbody></table></div>':'<div class="payroll-empty">Nenhum pagamento registrado.</div>')+'</div>';
    }
    function bindForms(){
        const employeeForm=$("#p-employee",host);
        employeeForm?.querySelector('[name="salarySplit"]')?.addEventListener("change",e=>{
            const split=e.currentTarget.value==="sim";
            const splitFields=employeeForm.querySelector("[data-salary-split-fields]");
            const integralFields=employeeForm.querySelector("[data-integral-payment-fields]");
            if(splitFields)splitFields.style.display=split?"":"none";
            if(integralFields)integralFields.style.display=split?"none":"";
        });
        employeeForm?.querySelector('[name="integralPaymentDay"]')?.addEventListener("change",e=>{
            const field=employeeForm.querySelector("[data-integral-other-field]");
            if(field)field.style.display=e.currentTarget.value==="outro"?"":"none";
        });
        employeeForm?.querySelector('[name="state"]')?.addEventListener("input",e=>{e.currentTarget.value=e.currentTarget.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,2);});
        employeeForm?.querySelector('[name="postalCode"]')?.addEventListener("input",e=>{
            const digits=e.currentTarget.value.replace(/\D/g,"").slice(0,8);
            e.currentTarget.value=digits.length>5?digits.slice(0,5)+"-"+digits.slice(5):digits;
        });
        employeeForm?.addEventListener("submit", async e=>{
            e.preventDefault();
            const form=e.currentTarget, submit=form.querySelector('button[type="submit"]'), f=new FormData(form);
            const name=String(f.get("name")||"").trim();
            if(!name || !window.PRIMEAuth) return;
            const salary=Number(f.get("salary")||0), salarySplit=String(f.get("salarySplit")||"nao")==="sim";
            const day5=salarySplit?Number(f.get("salaryDay5Amount")||0):0;
            const day20=salarySplit?Number(f.get("salaryDay20Amount")||0):0;
            if(salarySplit && Math.round((day5+day20)*100)!==Math.round(salary*100)){
                alert("A soma do 5º dia útil e do dia 20 deve ser igual à remuneração mensal.");
                return;
            }
            const integralChoice=String(f.get("integralPaymentDay")||"5o_dia_util");
            const integralDay=salarySplit?null:(integralChoice==="outro"?String(f.get("integralPaymentDayOther")||"").trim():integralChoice);
            if(!salarySplit && !integralDay){alert("Informe o dia do pagamento integral.");return;}
            const startDate=String(f.get("startDate")||"");
            const contractEndDate=String(f.get("contractEndDate")||"")||null;
            if(contractEndDate && contractEndDate<startDate){alert("O fim do contrato não pode ser anterior ao início.");return;}
            if(submit){submit.disabled=true;submit.textContent=editingEmployeeId?"Salvando alterações...":"Salvando...";}
            const payload={
                name, tax_id:String(f.get("taxId")||"").trim()||null,
                phone:String(f.get("phone")||"").trim()||null,
                address:String(f.get("address")||"").trim()||null,
                address_number:String(f.get("addressNumber")||"").trim()||null,
                postal_code:String(f.get("postalCode")||"").trim()||null,
                city:String(f.get("city")||"").trim()||null,
                state:String(f.get("state")||"").trim().toUpperCase()||null,
                marital_status:String(f.get("maritalStatus")||"")||null,
                employment_type:String(f.get("type")||"CLT"),
                role:String(f.get("role")||"").trim()||null,
                department:String(f.get("department")||"").trim()||null,
                cost_center:String(f.get("costCenter")||"").trim()||null,
                start_date:startDate, contract_end_date:contractEndDate,
                salary, salary_split:salarySplit, salary_day5_amount:day5,
                salary_day20_amount:day20, integral_payment_day:integralDay,
                is_active:String(f.get("status")||"ativo")==="ativo"
            };
            try{
                if(editingEmployeeId){
                    await window.PRIMEAuth.requestCompany("/payroll/employees/"+encodeURIComponent(editingEmployeeId),{method:"PATCH",body:JSON.stringify(payload)});
                }else{
                    await window.PRIMEAuth.requestCompany("/payroll/employees",{method:"POST",body:JSON.stringify(payload)});
                }
                editingEmployeeId=null;
                await syncAll();
                form.reset();
                draw();
            }catch(error){alert(error.message||"Não foi possível salvar o funcionário no backend.");}
            finally{if(submit){submit.disabled=false;submit.textContent=editingEmployeeId?"Salvar alterações":"Salvar funcionário";}}
        });
        host.querySelector("[data-p-employee-cancel]")?.addEventListener("click",()=>{editingEmployeeId=null;draw();});
        host.querySelectorAll("[data-p-employee-edit]").forEach(b=>b.addEventListener("click",()=>{
            const employee=allEmployees().find(x=>String(x.id)===String(b.dataset.pEmployeeEdit));
            if(!employee){alert("Funcionário não encontrado. Atualize a lista e tente novamente.");return;}
            editingEmployeeId=employee.id;
            draw();
            host.querySelector("#p-employee")?.scrollIntoView({behavior:"smooth",block:"start"});
        }));
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
            const items=[...current.items.map(i=>({id:i.id,employee_id:i.employeeId,description:i.description,kind:i.kind,amount:i.amount,created_at:i.createdAt||null,due_date:i.dueDate||null,source:i.source||"manual",approved:Boolean(i.approved),payment_id:i.paymentId||null,extra_category:i.extraCategory||null})),item];
            const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Salvando...";}
            try{
                await window.PRIMEAuth.requestCompany("/payroll/periods/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({items})});
                await syncRemoteRecords();draw();
            }catch(error){alert(error.message||"Não foi possível salvar a rubrica.");}
            finally{if(submit){submit.disabled=false;submit.textContent="Adicionar rubrica";}}
        });
        host.querySelectorAll("[data-p-extra-toggle]").forEach(b=>b.addEventListener("click",()=>{
            const form=host.querySelector('[data-p-extra-form="'+CSS.escape(b.dataset.pExtraToggle)+'"]');if(form)form.style.display=form.style.display==="none"?"":"none";
        }));
        host.querySelectorAll("[data-p-extra-form]").forEach(form=>form.querySelector('[name="category"]')?.addEventListener("change",e=>{
            const wrap=form.querySelector("[data-extra-description-wrap]");if(wrap)wrap.style.display=e.target.value==="OUTROS"?"":"none";
        }));
        host.querySelectorAll("[data-p-extra-form]").forEach(form=>form.addEventListener("submit",async e=>{
            e.preventDefault();const current=period();if(!current||!window.PRIMEAuth)return;
            const f=new FormData(form),category=String(f.get("category")||""),amount=Number(f.get("amount")||0),description=String(f.get("description")||"").trim();
            if(!(amount>0)){alert("Informe um valor maior que zero.");return;}if(category==="OUTROS"&&!description){alert("Descreva o custo extra em Outros.");return;}
            const base=current.items.find(i=>i.id===form.dataset.pExtraForm);if(!base)return;
            const extra={id:makeId(),employee_id:base.employeeId,description:category==="OUTROS"?"Outros — "+description:category,kind:"provento/custo",amount,created_at:new Date().toISOString(),due_date:base.dueDate||month+"-20",source:"extra_cost",approved:false,payment_id:null,extra_category:category};
            const items=[...current.items.map(i=>({id:i.id,employee_id:i.employeeId,description:i.description,kind:i.kind,amount:i.amount,created_at:i.createdAt||null,due_date:i.dueDate||null,source:i.source||"manual",approved:Boolean(i.approved),payment_id:i.paymentId||null,extra_category:i.extraCategory||null})),extra];
            try{await window.PRIMEAuth.requestCompany("/payroll/periods/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({items})});await syncRemoteRecords();draw();}catch(error){alert(error.message||"Não foi possível salvar o custo extra.");}
        }));
        host.querySelectorAll("[data-p-send]").forEach(b=>b.addEventListener("click",async()=>{
            const current=period(),item=current?.items.find(i=>i.id===b.dataset.pSend),employee=item&&employeeById(item.employeeId);if(!current||!item||!employee||!window.PRIMEAuth)return;
            if(item.paymentId||item.approved){alert("Esta rubrica já foi enviada para pagamento.");return;}
            if(!confirm("Aprovar "+employee.name+" — "+item.description+" ("+money(item.amount)+") e enviar para Pagamentos?"))return;
            b.disabled=true;
            try{
                const payment=await window.PRIMEAuth.requestCompany("/payroll/payments",{method:"POST",body:JSON.stringify({month,employee_id:employee.id,payment_type:item.source==="extra_cost"?"beneficio":item.description.includes("5º dia útil")?"saldo":item.description.includes("dia 20")?"adiantamento":"outro",amount:Number(item.amount),due_date:item.dueDate||month+"-20",status:"pendente",paid_at:null,method:null})});
                const items=current.items.map(i=>({id:i.id,employee_id:i.employeeId,description:i.description,kind:i.kind,amount:i.amount,created_at:i.createdAt||null,due_date:i.dueDate||null,source:i.source||"manual",approved:i.id===item.id?true:Boolean(i.approved),payment_id:i.id===item.id?payment.id:i.paymentId||null,extra_category:i.extraCategory||null}));
                await window.PRIMEAuth.requestCompany("/payroll/periods/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({items})});await syncRemoteRecords();tab="pagamentos";draw();
            }catch(error){alert(error.message||"Não foi possível enviar o pagamento.");b.disabled=false;}
        }));
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
            if(!window.PRIMEAuth)return;
            const paidAt=prompt("Informe a data real do pagamento (AAAA-MM-DD):",today());if(paidAt===null)return;
            if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(paidAt.trim())){alert("Data inválida. Use AAAA-MM-DD.");return;}
            if(!confirm("Confirmar que o pagamento foi realizado em "+paidAt+"?"))return;
            try{
                await window.PRIMEAuth.requestCompany("/payroll/payments/"+encodeURIComponent(b.dataset.pPaid),{method:"PATCH",body:JSON.stringify({status:"pago",paid_at:paidAt.trim()})});
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