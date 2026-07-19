# Arquitetura de Navegação do SAULO AI

## 1. Objetivo

Manter Clínica, Gestão e Performance separadas, preservando o Prontuário Mestre como centro do fluxo clínico e evitando que novos módulos substituam os existentes.

## 2. Áreas principais

- Clínica: paciente, Prontuário Mestre e atendimento.
- Gestão: Painel do CEO, Central de Inteligência, Central de Dados e Importações.
- Performance: Performance Endurance SV.
- Administração: Biblioteca Científica e futuros cadastros transversais autorizados.
- Configurações: itens futuros, sem links falsos.

## 3. Área Clínica

Pacientes e Agenda clínica ficam no grupo Clínica do shell. Os módulos de um paciente ficam exclusivamente na navegação agrupada do Prontuário Mestre.

## 4. Área Gestão

Painel do CEO, Central de Inteligência, Central de Dados e Importações permanecem fora do prontuário. Importações é acessível pela Gestão e pelo Painel do CEO.

A Biblioteca Científica permanece no grupo Administração e nunca integra as abas do paciente.

## 5. Área Performance

Performance Endurance possui grupo próprio. Seus painéis internos não são transformados em abas clínicas. No prontuário há somente um acesso contextual quando o mock identifica atleta e usuário autorizado.

## 6. Prontuário Mestre

A rota principal continua sendo `/pacientes/[patientId]`. `PatientNavigation`, `PatientHubHeader` e `MasterRecordTabs` evoluem a tela existente; nenhum segundo prontuário foi criado.

## 7. Ordem dos módulos clínicos

Resumo, Anamnese, Avaliação Física, Avaliação Postural, Antropometria, Perimetria, Bioimpedância, Exames, Atendimentos, Coleta Clínica, Painel Clínico, Decisão Clínica, Estratégia Nutricional, Plano Alimentar, Plano de Treino, Evolução e Entregáveis. Performance Endurance é contextual e não participa da sequência clínica.

## 8. Categorias de navegação

Geral; Coleta e histórico; Avaliações; Decisão; Prescrições; Documentos; Contexto do atleta. As categorias são recolhíveis, responsivas e evitam uma linha horizontal interminável.

## 9. Permissões

Saulo visualiza Clínica, Gestão, Performance e Nutrição. Maria visualiza somente a área Clínica e não recebe Plano Alimentar, Estratégia Nutricional ou Performance. A Central de Dados mantém internamente as permissões compartilhadas previamente aprovadas, embora não apareça no menu principal de Maria.

## 10. Pré-condições

Painel Clínico exige coleta acessível e concluída. Decisão Clínica exige Painel confirmado e `CLINICAL_REASONING/READ`. Estratégia Nutricional exige a etapa clínica anterior dentro do fluxo demonstrativo. Plano Alimentar depende da Estratégia Nutricional registrada. Avaliação Postural continua obrigatória no Atendimento Completo SV. Itens futuros não recebem links nem aparência de concluídos.

## 11. Breadcrumb

O breadcrumb semântico existente é reutilizado em Clínica, Gestão e Performance. Links anteriores preservam destinos previsíveis e, no prontuário, mantêm paciente e cenário.

## 12. Voltar ao Prontuário Mestre

Todas as páginas clínicas que usam `PatientNavigation` recebem link explícito para `/pacientes/[patientId]?scenario=...`. A página de continuidade do atendimento passou a usar o mesmo componente. Não se depende de `router.back()`.

## 13. Navegação Anterior e Próximo

Ordem, labels, rotas, permissões e pré-condições vêm de `src/features/master-record-navigation/config.ts`. Módulos ocultos e futuros sem rota são ignorados. O próximo módulo bloqueado informa a pré-condição.

## 14. Responsividade

No desktop, os módulos aparecem em grupos. No celular, cada grupo é recolhível, sem faixa horizontal. O shell usa menu móvel por áreas e atalhos inferiores com colunas calculadas sem overflow.

## 15. Como adicionar um novo módulo sem remover os existentes

Adicionar uma entrada a `MASTER_RECORD_MODULES`, com ID, cardId, ordem, categoria, rota, audiência, status futuro e pré-condição. Depois, implementar ou associar o resolver de rota. Não criar listas locais em páginas.

## 16. Regras para futuras sprints

- Novas sprints não podem substituir a configuração dos módulos.
- Novos módulos devem ser acrescentados à fonte central.
- Módulos funcionais não podem ficar acessíveis apenas por URL.
- Gestão não deve ser misturada ao prontuário.
- Performance não deve substituir a Clínica.
- Módulos futuros não devem receber páginas vazias apenas para preencher a navegação.

`docs/frontend-master.md` não existe no repositório atual e, por isso, não foi atualizado.
