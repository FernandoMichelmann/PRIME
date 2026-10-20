# PRIME Backend — ambiente local

Fundação da API do PRIME ERP. O frontend existente permanece separado e inalterado.

## Requisitos

- Python 3.11 ou superior
- PostgreSQL 15 ou superior
- Git

## Configurar e executar a API

Dentro da pasta `backend`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edite `.env` para apontar para um banco de desenvolvimento local. Nunca versionar esse arquivo nem usar credenciais de produção.

Inicie a API:

```bash
python -m uvicorn app.main:app --reload --reload-dir app --reload-dir migrations
```

- Documentação OpenAPI: `http://127.0.0.1:8000/docs`
- Processo ativo: `http://127.0.0.1:8000/health/live`
- Banco acessível: `http://127.0.0.1:8000/health/ready`

## Migrações

Revise a migração antes de aplicar. Em ambiente local, com o banco correto selecionado:

```bash
python -m alembic upgrade head
python -m alembic current
```

Para gerar futuras revisões a partir dos modelos:

```bash
python -m alembic revision --autogenerate -m "descricao"
```

Não aplique migrações em produção sem revisão, backup e plano de reversão.

## Testes

```bash
python -m pytest -q
```

## Modelo inicial e limites

- `companies`: transportadoras/empresas.
- `users`: identidade de acesso global; senha armazenada apenas como hash.
- `roles` e `permissions`: papéis e permissões.
- `user_company_roles`: papéis atribuídos por empresa.
- `role_permissions`: permissões de cada papel.
- `audit_logs`: trilha de auditoria.

A presença dessas tabelas não significa que a autorização multiempresa já esteja concluída: cada endpoint de negócio deverá validar a identidade, a empresa ativa e as permissões no backend. Ainda não há endpoints de login, tokens, cadastro de empresas, dados de folha/financeiro/viagens nem importação do `localStorage`. Não publicar a API nem expor o PostgreSQL à rede nesta etapa.
