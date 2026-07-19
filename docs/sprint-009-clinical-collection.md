# Sprint 009 — Coleta Clínica Integrada

## Arquitetura

A coleta foi adicionada como feature de front-end em `src/features/clinical-collection`. Os DTOs tipam somente os campos aprovados nesta Sprint e não alteram o domínio ou o Prisma, que continuam armazenando as medições estruturadas em `JsonValue`.

`ClinicalCollectionGateway` é a porta substituível. O adaptador atual é `mockClinicalCollectionGateway`, sem PostgreSQL, autenticação real ou chamadas HTTP. Cada origem aponta para o mesmo `MasterRecord` demonstrativo.

## Rota

`/pacientes/[patientId]/atendimentos/[attendanceId]/coleta`

A rota aceita temporariamente `?scenario=` apenas para validação dos mocks.

## Cenários

- `partial-saulo`: antropometria completa por Saulo e bioimpedância parcial.
- `maria-continuity`: o mesmo paciente e os mesmos registros de Saulo abertos por Maria, sem nova solicitação dos valores existentes.
- `complete`: quatro etapas obrigatórias completas e resumo liberado.
- `mandatory-pending`: vista lateral esquerda pendente; conclusão bloqueada.
- `previous-comparison`: perimetria atual com referência visual à avaliação anterior.

Todos os cenários são claramente demonstrativos. O seletor também ajusta a sessão visual mockada para Maria nos cenários correspondentes; isso não representa autenticação.

## Regras do fluxo mock

- abre a primeira etapa incompleta;
- preserva campos previamente preenchidos;
- calcula apenas o IMC da antropometria no service mock, sem solicitar digitação;
- atualiza autoria, horário, versão, progresso e última etapa após o salvamento local;
- bloqueia a conclusão enquanto qualquer uma das quatro etapas estiver incompleta;
- marca a próxima etapa como `Painel Clínico / Motor de Decisão`, sem implementar o motor;
- alerta antes de navegar entre etapas ou fechar a página com alterações não salvas.

## Endpoints futuros necessários

Os caminhos abaixo são necessidades de integração e ainda não são contratos aprovados:

- `GET /api/patients/:patientId/attendances/:attendanceId/clinical-collection`
- `PUT /api/patients/:patientId/attendances/:attendanceId/clinical-collection/:step`
- `POST /api/patients/:patientId/attendances/:attendanceId/clinical-collection/complete`

Os DTOs HTTP, códigos de erro, controle de concorrência, idempotência e autorização deverão ser aprovados no back-end antes da troca do adaptador.

## Limitações temporárias

- estado mockado permanece somente na instância do navegador;
- recarregar a página restaura o seed do cenário;
- não há upload de imagens, IA, interpretação clínica ou análise postural automática;
- comparação da perimetria mostra somente diferença numérica, sem inferir causalidade ou qualidade clínica;
- o vínculo de exercícios corretivos é apenas um estado informativo futuro;
- conclusão atualiza apenas o agregado mock da coleta/continuidade.

## Validação visual

A rota foi capturada em 1440, 1024, 768 e viewport móvel compacto. A revisão resultou em contenção horizontal do shell, quebra de texto no contexto do paciente e stepper móvel rolável sem barra visual. Grids passam de três colunas para duas e uma coluna conforme a largura, com barra de ação acima da navegação inferior.
