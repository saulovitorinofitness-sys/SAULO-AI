import type { ClinicalDecisionAlert, ClinicalDecisionEvidence, ClinicalDecisionPendingItem, ClinicalDecisionReviewPoint, ClinicalDecisionScenario, ProfessionalClinicalDecision } from "./contracts";

export const clinicalDecisionScenarios: readonly ClinicalDecisionScenario[] = [
  { key: "COMPLETE", label: "Completo · Saulo", description: "Coleta completa, poucos alertas e decisão anterior." },
  { key: "POSTURAL_PENDING", label: "Postural pendente", description: "Atendimento Completo SV sem avaliação postural concluída." },
  { key: "MARIA_FUNCTIONAL", label: "Visão funcional · Maria", description: "Nutrição ocultada e decisões limitadas às áreas autorizadas." },
  { key: "EMPTY", label: "Sem evidências", description: "Estado vazio para validação da interface." },
  { key: "SAVE_ERROR", label: "Erro ao salvar", description: "Simula falha no adaptador mockado." },
];

export const sharedEvidenceSeed: readonly ClinicalDecisionEvidence[] = [
  { id: "ev-age", area: "GENERAL", label: "Idade", value: "34 anos", source: "Identificação compartilhada" },
  { id: "ev-sex", area: "GENERAL", label: "Sexo", value: "Masculino", source: "Identificação compartilhada" },
  { id: "ev-goal", area: "GENERAL", label: "Objetivo principal", value: "Não disponibilizado no mock atual", source: "Prontuário Mestre" },
  { id: "ev-history", area: "CLINICAL_HISTORY", label: "Histórico clínico", value: "Registro disponível para revisão profissional", source: "Histórico clínico · mock", recordedAt: "2026-07-15T16:50:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
  { id: "ev-medication", area: "CLINICAL_HISTORY", label: "Medicamentos", value: "Registro demonstrativo aguardando revisão", source: "Histórico clínico · mock", recordedAt: "2026-06-10T09:00:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
  { id: "ev-training", area: "PHYSICAL_EDUCATION", label: "Histórico de treinamento", value: "Informação disponível para conferência", source: "Acompanhamento físico · mock", recordedAt: "2026-07-02T11:00:00-03:00", recordedBy: "Maria de Lourdes Gomes" },
  { id: "ev-nutrition", area: "NUTRITION", label: "Rotina alimentar", value: "Registro nutricional demonstrativo disponível", source: "Nutrição · mock", recordedAt: "2026-07-10T08:30:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
  { id: "ev-lab", area: "LABORATORY", label: "Exames laboratoriais", value: "Último registro demonstrativo em 10/01/2026", source: "Exames laboratoriais · mock", recordedAt: "2026-01-10T08:00:00-03:00", recordedBy: "Saulo Xavier Vitorino" },
];

export const alertSeed: readonly ClinicalDecisionAlert[] = [
  { id: "alert-med", title: "Revisão de medicamento pendente", description: "Há um medicamento registrado sem revisão recente no mock.", level: "ATTENTION", area: "CLINICAL_HISTORY", source: "Histórico clínico", status: "PENDING", createdAt: "2026-07-16T10:20:00-03:00", actionLabel: "Revisar registro" },
  { id: "alert-lab", title: "Exame laboratorial desatualizado", description: "Pode ser relevante verificar se os exames disponíveis ainda apoiam a análise atual.", level: "INFORMATIVE", area: "LABORATORY", source: "Exames laboratoriais", status: "PENDING", createdAt: "2026-07-16T10:21:00-03:00", actionLabel: "Verificar exames" },
];

export const pendingSeed: readonly ClinicalDecisionPendingItem[] = [
  { id: "pending-lab", description: "Confirmar atualidade dos exames laboratoriais disponíveis.", area: "LABORATORY", priority: "INFORMATIVE", reason: "O registro demonstrativo possui data anterior ao atendimento atual.", possibleResponsible: "Profissional habilitado", suggestedAction: "Verificar necessidade de atualização", status: "PENDING" },
];

export const reviewPointSeed: readonly ClinicalDecisionReviewPoint[] = [
  { id: "review-routine", title: "Considerar avaliação do impacto da rotina sobre o acompanhamento", rationale: "Há registros de histórico e rotina que podem ser relevantes analisar em conjunto.", evidenceIds: ["ev-history", "ev-training"], area: "GENERAL", relevance: "ATTENTION", status: "PENDING" },
  { id: "review-lab", title: "Verificar necessidade de atualização dos exames", rationale: "A informação disponível necessita confirmação profissional quanto à atualidade.", evidenceIds: ["ev-lab"], area: "LABORATORY", relevance: "INFORMATIVE", status: "PENDING" },
  { id: "review-nutrition", title: "Revisar compatibilidade entre objetivo e estratégia nutricional atual", rationale: "Ponto de apoio exclusivo para profissional autorizado; não representa prescrição.", evidenceIds: ["ev-goal", "ev-nutrition"], area: "NUTRITION", relevance: "ATTENTION", status: "PENDING" },
];

export const previousDecisionSeed: ProfessionalClinicalDecision = {
  id: "decision-previous-001", patientId: "demo-patient-001", professionalId: "00000000-0000-4000-8000-000000000001", professionalName: "Saulo Xavier Vitorino", area: "GENERAL", decision: "Manter acompanhamento e revisar dados na próxima avaliação.", rationale: "Decisão profissional demonstrativa baseada nos registros disponíveis naquele atendimento.", priority: "INFORMATIVE", conducts: ["Manter acompanhamento"], followUpRequired: true, reassessmentDate: "2026-08-16", source: "OWN_DECISION", createdAt: "2026-06-18T15:10:00-03:00", status: "REVIEWED",
};
