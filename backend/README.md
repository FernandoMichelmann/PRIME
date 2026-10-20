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

## Autenticação inicial

- `POST /api/v1/auth/login`: recebe `email` e `password` em JSON e devolve um token JWT de acesso.
- `GET /api/v1/auth/me`: exige `Authorization: Bearer <token>` e retorna a identidade e as empresas vinculadas.
- `GET /api/v1/auth/companies`: lista apenas empresas ativas com vínculo ativo para o usuário autenticado.
- Dependência `require_company_permission("permission.code")`: exige token, cabeçalho `X-Company-ID`, vínculo ativo, empresa ativa e permissão correspondente.

O token expira em 30 minutos por padrão. Senhas devem ser armazenadas somente como hash Argon2id. As rotas não criam usuários ou empresas automaticamente; o provisionamento inicial controlado será uma etapa separada. Não existe recuperação de senha ou refresh token nesta fase.

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

A autorização multiempresa deve ser aplicada explicitamente em cada endpoint de negócio. O helper de autorização já valida a empresa e a permissão no banco, mas ainda não há rotas de negócio usando-o. Ainda não existem endpoints de cadastro de empresas/usuários, dados de folha/financeiro/viagens nem importação do `localStorage`. Não publicar a API nem expor o PostgreSQL à rede nesta etapa.

Em produção, configure `APP_ENV=production` e `SECRET_KEY` com um segredo aleatório exclusivo de pelo menos 32 caracteres. O segredo de desenvolvimento não deve ser usado em produção.
