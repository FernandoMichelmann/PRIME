# PRIME — Auditoria e arquitetura inicial do Fluxo de Caixa

## Base auditada

Implementação baseada na branch `feature/modulo-receitas-prime`, preservando a estrutura HTML/CSS/JavaScript existente.

## Fontes de dados identificadas

- **Receitas:** `revenue.js`, persistidas em `primeRevenueDemoV1`. Campos financeiros usados: `reference`, `description`, `category`, `total_amount`, `received_amount`, `payment_status`, `payment_date`, `due_date` (com fallback para `competency_date` e `service_date`).
- **Despesas:** `main.js`, persistidas em `primeVariableExpensesV1`. O sistema grava despesas com parcelas em `installments[]`; cada parcela possui identificador, valor, data, `paid` e `paidAt`. Despesas recorrentes já geradas no cadastro são lidas como ocorrências existentes; o Fluxo de Caixa não gera novas ocorrências.
- **Folha:** `payroll.js`, fonte de pagamentos `data.payments` sincronizada pela API quando há autenticação/backend. Foi exposta uma leitura pública `getCashFlowPayments()`; o módulo não cria pagamentos da folha.
- **Persistência do saldo de abertura:** `primeCashFlowSettingsV1`, contendo saldo, data de referência e data de atualização.

## Regras implementadas nesta etapa

- Valores convertidos para centavos inteiros durante os cálculos.
- Saldo disponível separado de contas pendentes.
- Saldo de abertura não é receita operacional.
- Receitas recebidas e despesas pagas são contabilizadas pela data de liquidação.
- Receitas parcialmente recebidas são separadas em parte realizada e saldo pendente.
- Parcelas de despesas são consolidadas pelo identificador da ocorrência.
- Pagamentos da folha são lidos por identificador da folha e não são criados novamente.
- A projeção mensal carrega o saldo anterior e considera compromissos pendentes cadastrados.
- A tela usa os estilos existentes do PRIME e CSS isolado, sem alteração global do tema.
- Exportação CSV, filtros de tipo/status/pesquisa e calendário usam os registros consolidados.
- O saldo de abertura ausente é tratado como configuração pendente; nenhum valor inicial é inventado.

## Arquivos alterados

- `index.html`: carrega `cash-flow.js`.
- `cash-flow.js`: novo módulo, consolidação, indicadores, projeção de 12 meses, alertas, calendário, filtros, CSV e configuração do saldo.
- `payroll.js`: expõe os pagamentos da folha para leitura pelo Fluxo de Caixa.

## Validação executada

Testes automatizados de lógica com armazenamento e DOM simulados:
1. Saldo de abertura R$ 10.000 + recebimento R$ 2.000 - pagamento R$ 4.000 = R$ 8.000.
2. Despesa pendente de R$ 3.000 não altera o saldo disponível e reduz a projeção mensal de R$ 10.000 para R$ 7.000.
3. Ao marcar a despesa de R$ 3.000 como paga, saldo disponível e projeção ficam em R$ 7.000, sem desconto duplicado.
4. Receita de R$ 5.000 aparece uma única vez na consolidação.
5. Pagamento pendente de folha de R$ 3.000 é lido como uma saída de caixa.

Validação sintática executada em `cash-flow.js`, `payroll.js`, `main.js` e `revenue.js`.

## Limitações conhecidas / próxima etapa

- A API atual da folha fornece pagamentos programados, mas a fonte de dados deve ser verificada em ambiente autenticado para validar a sincronização real do backend.
- Não há ainda uma chave de vínculo universal entre um pagamento da folha e uma despesa manual já cadastrada; a arquitetura atual do Dashboard trata a folha separadamente. Antes de produção, revisar possíveis lançamentos manuais que representem o mesmo compromisso.
- A etapa atual não implementa simulador de cenários, exportação Excel/PDF, comparação completa de competência versus caixa, detalhamento de custo por competência nem abertura do registro original ao clicar numa movimentação.
- A projeção considera os compromissos cadastrados, não uma garantia de recebimento; não há modelo estatístico de inadimplência.
- O saldo disponível só é confiável depois que o usuário configura o saldo de abertura e sua data de referência.
- Antes de mesclar para a branch principal, executar teste manual no navegador com backend autenticado, conferir console e realizar regressão de Receitas, Despesas, Folha e Dashboard.
