# PRIME — primeira etapa do módulo Folha

Esta etapa adiciona o cadastro de funcionários ao backend multiempresa. Ela não transforma ainda as competências, rubricas ou pagamentos em registros do banco; esses fluxos permanecem no armazenamento local até etapas posteriores.

## Endpoints

Todos os endpoints exigem token Bearer e o cabeçalho `X-Company-ID` com o identificador da transportadora ativa.

- `GET /api/v1/payroll/employees` — lista funcionários da empresa autorizada; exige `payroll.read`.
- `POST /api/v1/payroll/employees` — cadastra funcionário; exige `payroll.write`.
- `PATCH /api/v1/payroll/employees/{employee_id}` — atualiza dados; exige `payroll.write`.
- `PATCH /api/v1/payroll/employees/{employee_id}/status?is_active=true|false` — ativa/inativa; exige `payroll.write`.

Os registros incluem `company_id`, e as consultas e alterações sempre restringem a operação à empresa do vínculo autorizado. Documentos duplicados são impedidos dentro da mesma empresa. As ações de criação, edição e alteração de status geram registros de auditoria.

## Aplicar a migração local

Na pasta do repositório:

```bash
cd backend
alembic upgrade head
```

Depois, inicie a API conforme as instruções de `backend/README.md` e consulte `/docs` no ambiente de desenvolvimento para inspecionar os endpoints.

## Testes

```bash
cd backend
pytest
```

Os testes incluem a presença da tabela no metadata e a exigência de autenticação para os endpoints.

## Limites desta etapa

- Competências, rubricas e pagamentos ainda não foram migrados para o PostgreSQL.
- Não há cálculo automático de INSS, IRRF, FGTS, férias, 13º ou rescisões.
- A integração da interface de funcionários com estes endpoints deve ser validada antes de considerar o fluxo pronto para uso operacional.
- A API precisa de migração aplicada e de um usuário com vínculo ativo e permissões de Folha.
