# PRIME Backend — ambiente local

Esta é a fundação inicial da API do PRIME ERP. O frontend existente permanece separado e inalterado.

## Requisitos

- Python 3.11 ou superior
- Docker Desktop com Docker Compose
- Git

## Iniciar PostgreSQL local

No terminal, dentro da pasta `backend`:

```bash
docker compose up -d postgres
docker compose ps
```

O PostgreSQL escuta somente em `127.0.0.1:5432`. A senha configurada no Compose é exclusivamente para desenvolvimento local e não deve ser reutilizada fora dele.

## Configurar e executar a API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

A API ficará disponível em `http://127.0.0.1:8000`.

- Documentação OpenAPI: `http://127.0.0.1:8000/docs`
- Processo ativo: `http://127.0.0.1:8000/health/live`
- Banco acessível: `http://127.0.0.1:8000/health/ready`

## Executar testes

Com o ambiente virtual ativo e dependências instaladas:

```bash
pytest
```

Os testes iniciais cobrem a inicialização da API e o endpoint de liveness. O teste de prontidão do banco exige o PostgreSQL em execução.

## Estado e limites desta etapa

- Ainda não existe autenticação real.
- Ainda não existem tabelas de negócio nem migrações Alembic.
- Nenhum módulo do frontend foi conectado à API.
- Ainda não há importação dos dados de `localStorage`.
- Não publicar esta API nem expor a porta do PostgreSQL à rede.
- Não usar dados reais neste ambiente de desenvolvimento.

Próxima etapa: inventariar o armazenamento local e as regras existentes no frontend; documentar o modelo de dados; então implementar migrações, empresas, vínculos, autenticação e autorização com testes de isolamento multiempresa antes de conectar módulos financeiros.
