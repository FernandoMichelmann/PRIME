# PRIME ERP — arquitetura inicial do backend

## Decisões confirmadas

- Desenvolvimento e execução inicialmente no computador do desenvolvedor; nenhuma hospedagem externa nesta fase.
- Backend Python com FastAPI.
- PostgreSQL local como banco relacional.
- SQLAlchemy 2.x para persistência e Alembic para migrações versionadas.
- Pydantic para validação; Pytest e HTTPX para testes.
- Aplicação modular única, sem microsserviços ou Redis na fundação.
- Frontend HTML/CSS/JavaScript preservado e migrado por módulo.
- Branch de trabalho: `feature/backend-prime-local`; sem alterações na `main` e sem publicação em produção.

## Fluxo de dados

Frontend atual → cliente HTTP centralizado (a implementar) → API versionada → serviços de domínio → SQLAlchemy → PostgreSQL.

A API inicial expõe endpoints de saúde. O prefixo reservado para recursos de negócio é `/api/v1`.

## Multiempresa: requisito de arquitetura

Cada entidade empresarial deverá possuir vínculo de tenant validado no servidor. A identidade autenticada e a associação ativa do usuário determinarão o tenant; um `company_id` enviado pelo navegador nunca será suficiente para autorizar acesso.

As relações entre entidades deverão usar restrições compostas ou mecanismos equivalentes para impedir associações entre empresas. Row-Level Security do PostgreSQL será avaliada e testada com papel de aplicação sem privilégios de bypass, contexto definido por transação e limpeza garantida entre transações. A estratégia final será validada antes de introduzir dados reais.

## Sequência de implementação

1. Inventariar arquivos, chaves de `localStorage`, leitura/escrita, cálculos e dependências do frontend.
2. Documentar o modelo de domínio e as regras existentes.
3. Criar base SQLAlchemy e configurar Alembic; adicionar migrações testadas.
4. Implementar empresas, usuários, vínculos, autenticação, sessões, papéis e permissões.
5. Criar testes de isolamento entre tenants e de autorização por recurso/ação.
6. Implementar cliente HTTP centralizado e migrar um módulo de baixo risco, após testes de regressão.
7. Migrar cadastros, financeiro, veículos, viagens, documentos, folha e relatórios em etapas.
8. Planejar exportação, validação e importação idempotente dos dados locais.
9. Definir backup, restauração, monitoramento e checklist de produção.
10. Avaliar hospedagem somente quando houver requisito e validação para isso.

## Segurança e limites atuais

Esta é uma fundação de desenvolvimento, não um backend pronto para produção. Ainda não há login, controle de permissões, tabelas de domínio, migrações, auditoria ou isolamento multiempresa implementados. Não inserir dados reais nem expor serviços à rede. A senha do Compose é fixa e serve apenas para uso local descartável; deve ser substituída por segredo gerenciado antes de qualquer ambiente compartilhado.
