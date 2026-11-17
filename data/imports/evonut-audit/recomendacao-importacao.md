# Recomendação de importação — Evonut

## Estado desta auditoria

- Arquivo original preservado: `DC2D9F78AD34205D4734DC656B54F30EB26752711B8A083B5E63F4B5C1A0CE81`.
- Nenhuma macro executada; proteção não alterada.
- Nenhum registro pessoal ou clínico exportado.
- Nenhuma importação ou alteração de banco/interface realizada.

## Fase 1 — fontes oficiais e estruturas já validadas

Manter a auditoria anterior de `BD_Alimentos` e `BD_Medidas`. Importar somente fontes com licença e identidade verificadas, preservando origem e código interno Evonut separadamente do código oficial.

## Fase 2 — métodos já equivalentes

Confrontar Mifflin-St Jeor, Harris-Benedict 1919, FAO/WHO 1985, IMC, GET e macronutrientes com os serviços existentes. Não copiar fórmulas; validar coeficientes na publicação original e acrescentar testes de regressão.

## Fase 3 — novas referências técnicas

Avaliar DRIs, percentis, antropometria avançada, METs e fatores clínicos. Exigir fonte/versionamento antes de modelar. Equações com referência incompleta ou suspeita, como “Guedes (1885)”, permanecem bloqueadas.

## Fase 4 — conteúdo configurável com revisão jurídica

Dietas (13), refeições (10) e receitas (14) podem inspirar modelos estruturais, mas o conteúdo Evonut não deve ser copiado sem licença. Recriar protocolos com autoria, evidência e aprovação clínica próprias.

## Fase 5 — conteúdo de alto risco

Formulações, fitoterápicos, probióticos, orientações clínicas, faixas de exames e prescrições exigem revisão clínica, regulatória e jurídica. Não devem alimentar geração automática nem prescrição sem governança específica.

## Conteúdo que não deve ser importado

- pacientes, contatos, documentos, atendimentos, agenda, anamnese, antropometria, exames e planos individuais;
- VBA, macros, fórmulas do aplicativo, imagens, telas, identidade visual e textos comerciais;
- caminhos locais, dados profissionais incorporados aos modelos e textos clínicos proprietários;
- qualquer conteúdo cuja licença, autoria ou referência bibliográfica permaneça não identificada.
