(function () {
"use strict";
const style = `
.prime-users{color:#e2e8f0}.prime-users *{box-sizing:border-box}
.prime-users-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:22px}
.prime-users h1{font-size:clamp(25px,3vw,34px);margin:7px 0;color:#f8fafc}
.prime-users p,.prime-users small{color:#94a3b8;font-size:12px;line-height:1.7}
.prime-users-panel,.prime-users-stat{background:#0b1422;border:1px solid #1e2c40;border-radius:10px;padding:18px;margin-bottom:16px}
.prime-users-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.prime-users-stat span{display:block;color:#94a3b8;font-size:12px}.prime-users-stat strong{display:block;font-size:26px;margin:8px 0;color:#f8fafc}
.prime-users button{border:1px solid #263851;border-radius:7px;padding:10px 13px;background:#2563eb;color:white;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.prime-users button.secondary,.prime-users button.action{background:#0b1525;color:#cbd5e1}.prime-users button:disabled{opacity:.6}
.prime-users .notice{padding:12px;margin-bottom:14px;border:1px solid #24456e;border-radius:7px;background:#12233b;color:#bfdbfe;font-size:12px}.prime-users .notice.error{background:#351a22;border-color:#6b2636;color:#fecdd3}
.prime-users-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.prime-users-panel h2{font-size:16px;margin:0;color:#f8fafc}
.prime-users input{height:41px;width:100%;border:1px solid #263851;border-radius:7px;background:#070e19;color:#f1f5f9;padding:0 11px;font:inherit;font-size:12px}
.prime-users .search{max-width:330px}.prime-users .table-wrap{overflow-x:auto}.prime-users table{border-collapse:collapse;width:100%;min-width:700px}
.prime-users th,.prime-users td{text-align:left;padding:12px;border-bottom:1px solid #1e2c40;font-size:12px}.prime-users th{font-size:10px;color:#94a3b8;text-transform:uppercase}
.prime-users .email{display:block;color:#94a3b8;font-size:11px;margin-top:4px}.prime-users .pill{padding:5px 8px;border-radius:20px;background:#12352d;color:#6ee7b7;font-size:10px}.prime-users .pill.off{background:#3a2028;color:#fda4af}
.prime-users .actions{display:flex;gap:6px}.prime-users button.action{padding:7px 9px;font-size:10px}
.prime-users .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.prime-users label span{display:block;font-size:11px;color:#cbd5e1;font-weight:600;margin-bottom:7px}.prime-users label.full{grid-column:1/-1}
.prime-users .form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.prime-users .form-message{margin-top:12px}
@media(max-width:700px){.prime-users-head,.prime-users-panel-head{align-items:stretch;flex-direction:column}.prime-users-stats,.prime-users .form-grid{grid-template-columns:1fr}.prime-users label.full{grid-column:auto}.prime-users .search{max-width:none}}
`;
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let original = "", users = [], search = "", notice = "", isError = false;
const root = () => document.querySelector(".content");
function addStyle(){if(document.getElementById("prime-users-css"))return;const s=document.createElement("style");s.id="prime-users-css";s.textContent=style;document.head.appendChild(s);}
async function api(path,opts={}){if(!window.PRIMEAuth?.requestCompany)throw Error("Entre no PRIME novamente para gerenciar cadastros.");return window.PRIMEAuth.requestCompany(path,opts);}
async function load(){users=await api("/users");}
function list(){
 const el=root(), filtered=users.filter(u=>[u.full_name,u.email,u.cpf,u.phone].join(" ").toLowerCase().includes(search.toLowerCase()));
 const active=users.filter(u=>u.is_active).length;
 el.innerHTML=`<section class="prime-users"><header class="prime-users-head"><div><div class="eyebrow">ADMINISTRAÇÃO DA EMPRESA</div><h1>Cadastros<span class="blue-period">.</span></h1><p>Cadastre e gerencie quem pode acessar o PRIME nesta empresa.</p></div><button data-action="new">+ Novo usuário</button></header>
 ${notice?`<div class="notice ${isError?"error":""}" role="status">${esc(notice)}</div>`:""}
 <div class="prime-users-stats"><article class="prime-users-stat"><span>Total de usuários</span><strong>${users.length}</strong><small>Vinculados a esta empresa</small></article><article class="prime-users-stat"><span>Ativos</span><strong>${active}</strong><small>Podem iniciar sessão</small></article><article class="prime-users-stat"><span>Inativos</span><strong>${users.length-active}</strong><small>Acesso bloqueado</small></article></div>
 <section class="prime-users-panel"><div class="prime-users-panel-head"><div><h2>Pessoas com acesso</h2><p>Os dados são salvos no banco de dados do PRIME.</p></div><input class="search" data-search placeholder="Buscar nome, e-mail, CPF ou telefone" value="${esc(search)}"></div><div class="table-wrap"><table><thead><tr><th>Nome / e-mail</th><th>CPF</th><th>Telefone</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody>
 ${filtered.map(u=>`<tr><td><strong>${esc(u.full_name)}</strong><span class="email">${esc(u.email)}</span></td><td>${esc(u.cpf||"—")}</td><td>${esc(u.phone||"—")}</td><td>${esc(u.role_name)}</td><td><span class="pill ${u.is_active?"":"off"}">${u.is_active?"Ativo":"Inativo"}</span></td><td><div class="actions"><button class="action" data-action="edit" data-id="${esc(u.id)}">Editar</button><button class="action" data-action="toggle" data-id="${esc(u.id)}">${u.is_active?"Desativar":"Ativar"}</button></div></td></tr>`).join("")||'<tr><td colspan="6">Nenhum usuário encontrado.</td></tr>'}
 </tbody></table></div></section></section>`;
 el.querySelector("[data-search]").addEventListener("input",e=>{search=e.target.value;const p=e.target.selectionStart;list();const i=root().querySelector("[data-search]");i.focus();i.setSelectionRange(p,p);});
 el.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",async()=>{
  const u=users.find(x=>x.id===b.dataset.id);
  if(b.dataset.action==="new"){form(null);return;} if(b.dataset.action==="edit"&&u){form(u);return;}
  if(b.dataset.action==="toggle"&&u){try{await api("/users/"+u.id+"/status",{method:"PATCH",body:JSON.stringify({is_active:!u.is_active})});notice="Status atualizado.";isError=false;await load();list();}catch(e){notice=e.message;isError=true;list();}}
 }));
}
function form(u){
 const editing=!!u, el=root();
 el.innerHTML=`<section class="prime-users"><header class="prime-users-head"><div><div class="eyebrow">ADMINISTRAÇÃO DA EMPRESA</div><h1>${editing?"Editar usuário":"Novo usuário"}<span class="blue-period">.</span></h1><p>O acesso será vinculado à empresa selecionada.</p></div></header><section class="prime-users-panel"><form id="prime-user-form"><div class="form-grid">
 <label class="full"><span>Nome completo *</span><input name="full_name" required minlength="3" maxlength="180" value="${esc(u?.full_name||"")}"></label>
 <label><span>Data de nascimento *</span><input name="birth_date" type="date" required value="${esc(u?.birth_date||"")}"></label>
 <label><span>CPF *</span><input name="cpf" required maxlength="14" placeholder="000.000.000-00" value="${esc(u?.cpf||"")}"></label>
 <label><span>RG *</span><input name="rg" required maxlength="30" value="${esc(u?.rg||"")}"></label>
 <label><span>Telefone *</span><input name="phone" type="tel" required maxlength="30" value="${esc(u?.phone||"")}"></label>
 <label class="full"><span>E-mail para acessar o app *</span><input name="email" type="email" required maxlength="254" value="${esc(u?.email||"")}"></label>
 ${editing?"":'<label class="full"><span>Senha inicial (mínimo 12 caracteres) *</span><input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"></label>'}
 </div><p>A senha é armazenada como hash no servidor. Este cadastro cria um usuário com perfil básico de consulta; permissões avançadas devem ser concedidas separadamente.</p><div class="form-actions"><button type="button" class="secondary" data-cancel>Cancelar</button><button type="submit">Salvar cadastro</button></div><div class="form-message" role="status"></div></form></section></section>`;
 el.querySelector("[data-cancel]").addEventListener("click",list);
 el.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type="submit"]'),m=f.querySelector(".form-message");b.disabled=true;b.textContent="Salvando...";m.textContent="";
 const data=Object.fromEntries(new FormData(f).entries());
 try{await api(editing?"/users/"+u.id:"/users",{method:editing?"PUT":"POST",body:JSON.stringify(data)});notice=editing?"Cadastro atualizado.":"Usuário cadastrado e vinculado à empresa.";isError=false;await load();list();}
 catch(err){m.textContent=err.message||"Falha ao salvar cadastro.";m.style.color="#fda4af";b.disabled=false;b.textContent="Salvar cadastro";}
 });
}
async function open(){const el=root();if(!el)return;if(!original)original=el.innerHTML;notice="";isError=false;el.innerHTML='<section class="prime-users"><div class="prime-users-panel">Carregando cadastros...</div></section>';try{await load();list();}catch(e){el.innerHTML=`<section class="prime-users"><header class="prime-users-head"><div><div class="eyebrow">ADMINISTRAÇÃO DA EMPRESA</div><h1>Cadastros<span class="blue-period">.</span></h1><p>Gerencie quem pode acessar o PRIME.</p></div></header><div class="notice error">${esc(e.message)}</div><button data-retry>Tentar novamente</button></section>`;el.querySelector("[data-retry]").addEventListener("click",open);}}
document.addEventListener("DOMContentLoaded",()=>{addStyle();const el=root();if(el)original=el.innerHTML;document.addEventListener("click",e=>{const nav=e.target.closest?.('.nav-item[data-page]');if(!nav)return;if(nav.dataset.page==="Cadastros"){e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n===nav));const title=document.querySelector("#currentPage");if(title)title.textContent="Cadastros";open();document.querySelector("#sidebar")?.classList.remove("open");}else if(root()?.querySelector(".prime-users"))root().innerHTML=original;},true);});
})();