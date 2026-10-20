# PRIME — inventário inicial do frontend

## Base inspecionada

- Branch de referência para o backend: `main`, commit `09af2d064dd9db44a58eba87839edb19c53a142e`.
- Branch `feature/modulo-folha-prime` existe, mas a comparação com `main` indicou divergência: a branch de folha tem 3 commits exclusivos e está 7 commits atrás de `main`. Por isso, a nova branch do backend foi criada a partir da `main` atual, sem mesclar nem reescrever branches existentes.
- Arquivos principais encontrados em `main`: `index.html`, `main.js`, `payroll.js`, `prime.css`.
- A branch de folha também contém `users.js`, mas esse arquivo não aparece na árvore atual de `main`. Sua funcionalidade precisa ser comparada antes de decidir se e como será integrada.

## Chaves localStorage confirmadas

| Chave | Arquivo | Uso identificado |
|---|---|---|
| `primeVariableExpensesV1` | `main.js` | Despesas variáveis |
| `primeVehicleTripsV1` | `main.js` | Viagens/lançamentos associados a veículos |
| `primeVehiclesV1` | `main.js` | Cadastro de veículos e custos |
| `primePayrollV1` | `payroll.js` | Objeto com arrays `employees`, `periods` e `payments` |

Este inventário é inicial, não exaustivo: devem ser inspecionados todos os usos de armazenamento, as estruturas internas, os eventos e os vínculos com dashboard e demais telas antes da migração.

## Dependências e comportamento observados

- `index.html` carrega `payroll.js` e `main.js` com `defer`.
- `payroll.js` emite o evento `prime:payroll-updated` após salvar, utilizado como ponto de integração a investigar.
- `main.js` contém funções próprias para carregar e salvar despesas variáveis, viagens e veículos.
- O módulo de folha calcula totais localmente; as fórmulas e o tratamento de estados devem ser documentados e validados antes de serem reproduzidos no backend.
- O frontend atual carrega Lucide e Chart.js por CDN; isso é independente da fundação inicial da API.

## Riscos e próximos passos

1. A aplicação atual usa armazenamento por navegador, que não fornece persistência central nem isolamento multiempresa.
2. A importação deve preservar uma cópia original, validar formatos e ser repetível sem duplicar dados.
3. Totais do dashboard podem depender de mais de uma fonte local; mapear as fórmulas completas antes de conectar a API.
4. A ausência de `users.js` na `main` atual precisa ser reconciliada com a branch de folha sem perder alterações recentes.
5. Não foram executados testes no ambiente local do proprietário durante esta alteração remota; os testes descritos no README são instruções, não resultados de execução.
