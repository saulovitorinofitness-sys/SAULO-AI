import { BUILT_IN_IDS } from "@/modules/permissions";
import { clinicalCollectionService, type ClinicalCollectionView } from "@/features/clinical-collection";
import { laboratoryExamsService } from "@/features/laboratory-exams";
import type { ClinicalDecisionArea, ClinicalDecisionEvidence, ClinicalDecisionScenarioKey, ClinicalDecisionWorkspace, GetClinicalDecisionWorkspaceInput, ProfessionalClinicalDecision } from "./contracts";
import type { ClinicalDecisionGateway } from "./gateway";
import { alertSeed, clinicalDecisionScenarios, pendingSeed, previousDecisionSeed, reviewPointSeed, sharedEvidenceSeed } from "./mock-data";

const allAreas: readonly ClinicalDecisionArea[] = ["NUTRITION", "PHYSICAL_EDUCATION", "PHYSICAL_ASSESSMENT", "BIOIMPEDANCE", "PERIMETRY", "POSTURAL_ASSESSMENT", "CLINICAL_HISTORY", "LABORATORY", "GENERAL"];
const mariaAreas: readonly ClinicalDecisionArea[] = ["PHYSICAL_EDUCATION", "PHYSICAL_ASSESSMENT", "BIOIMPEDANCE", "PERIMETRY", "POSTURAL_ASSESSMENT", "GENERAL"];

function format(value: number | undefined, unit: string) { return value === undefined ? "Não registrado" : `${value} ${unit}`; }
function collectionEvidence(collection: ClinicalCollectionView): ClinicalDecisionEvidence[] {
  const { anthropometry, bioimpedance, perimetry, posturalAssessment } = collection.records;
  const audit = (record: { audit?: { updatedAt: string; professionalName: string } }) => ({ recordedAt: record.audit?.updatedAt, recordedBy: record.audit?.professionalName });
  return [
    { id: "ev-weight", area: "PHYSICAL_ASSESSMENT", label: "Peso", value: format(anthropometry.data.weightKg, "kg"), source: anthropometry.origin?.label ?? "Prontuário Mestre", ...audit(anthropometry) },
    { id: "ev-height", area: "PHYSICAL_ASSESSMENT", label: "Estatura", value: format(anthropometry.data.heightCm, "cm"), source: anthropometry.origin?.label ?? "Prontuário Mestre", ...audit(anthropometry) },
    { id: "ev-bmi", area: "PHYSICAL_ASSESSMENT", label: "IMC registrado", value: format(anthropometry.data.bmi, "kg/m²"), source: anthropometry.origin?.label ?? "Prontuário Mestre", ...audit(anthropometry) },
    { id: "ev-bio-fat", area: "BIOIMPEDANCE", label: "Gordura corporal · Avanutri", value: format(bioimpedance.data.bodyFatPercent, "%"), source: bioimpedance.origin?.label ?? "Bioimpedância Avanutri", ...audit(bioimpedance) },
    { id: "ev-bio-muscle", area: "BIOIMPEDANCE", label: "Massa muscular esquelética · Avanutri", value: format(bioimpedance.data.skeletalMuscleMassKg, "kg"), source: bioimpedance.origin?.label ?? "Bioimpedância Avanutri", ...audit(bioimpedance) },
    { id: "ev-bio-water", area: "BIOIMPEDANCE", label: "Água corporal total · Avanutri", value: format(bioimpedance.data.totalBodyWaterL, "L"), source: bioimpedance.origin?.label ?? "Bioimpedância Avanutri", ...audit(bioimpedance) },
    { id: "ev-waist", area: "PERIMETRY", label: "Cintura", value: format(perimetry.data.waistCm, "cm"), source: perimetry.origin?.label ?? "Perimetria", ...audit(perimetry) },
    { id: "ev-hip", area: "PERIMETRY", label: "Quadril", value: format(perimetry.data.hipCm, "cm"), source: perimetry.origin?.label ?? "Perimetria", ...audit(perimetry) },
    { id: "ev-postural", area: "POSTURAL_ASSESSMENT", label: "Avaliação Postural", value: posturalAssessment.status === "COMPLETED" ? "Concluída nas vistas obrigatórias" : "Ausente ou incompleta", source: posturalAssessment.origin?.label ?? "Avaliação Postural", ...audit(posturalAssessment) },
    { id: "ev-limitations", area: "POSTURAL_ASSESSMENT", label: "Limitações funcionais", value: posturalAssessment.data.functionalLimitations === "FINDING_RECORDED" ? posturalAssessment.data.functionalLimitationsNotes ?? "Registro sem descrição" : posturalAssessment.data.functionalLimitations === "NO_FINDING_RECORDED" ? "Sem achado registrado" : "Não avaliado", source: "Avaliação Postural", ...audit(posturalAssessment) },
  ];
}

function deriveScenario(input: GetClinicalDecisionWorkspaceInput, maria: boolean): ClinicalDecisionScenarioKey {
  if (input.decisionScenario) return input.decisionScenario;
  if (maria) return "MARIA_FUNCTIONAL";
  if (input.collectionScenario === "mandatory-pending") return "POSTURAL_PENDING";
  return "COMPLETE";
}

function storageKey(workspace: ClinicalDecisionWorkspace) { return `saulo-ai:clinical-decisions:${workspace.patientId}:${workspace.attendanceId}:${workspace.scenario}`; }
function readHistory(workspace: ClinicalDecisionWorkspace): readonly ProfessionalClinicalDecision[] {
  if (typeof window === "undefined") return workspace.history;
  const raw = window.sessionStorage.getItem(storageKey(workspace));
  return raw ? JSON.parse(raw) as ProfessionalClinicalDecision[] : workspace.history;
}

export const clinicalDecisionService: ClinicalDecisionGateway = {
  async listScenarios() { return clinicalDecisionScenarios; },
  async getWorkspace(input) {
    const collection = await clinicalCollectionService.getCollection({ patientId: input.patientId, attendanceId: input.attendanceId, scenario: input.collectionScenario });
    if (!collection) return null;
    const maria = collection.connectedProfessional.professionalUserId === BUILT_IN_IDS.users.mariaDeLourdesGomes;
    const scenario = deriveScenario(input, maria);
    const isMaria = scenario === "MARIA_FUNCTIONAL" || maria;
    const posturalCompleted = scenario !== "POSTURAL_PENDING" && collection.records.posturalAssessment.status === "COMPLETED";
    const laboratory = await laboratoryExamsService.getAvailability({ patientId: input.patientId, scenario: input.collectionScenario });
    const laboratoryEvidence: ClinicalDecisionEvidence = { id: "ev-lab", area: "LABORATORY", label: "Disponibilidade de exames laboratoriais", value: laboratory.status === "NONE" ? "Não existe exame ativo" : laboratory.status === "UPDATED" ? "Existe exame atualizado" : "Existe exame antigo", source: "Exames Laboratoriais · mock", recordedAt: laboratory.latestCollectedAt ? `${laboratory.latestCollectedAt}T12:00:00-03:00` : undefined };
    let evidences = scenario === "EMPTY" ? [] : [...sharedEvidenceSeed.filter((item) => item.id !== "ev-lab"), laboratoryEvidence, ...collectionEvidence(collection)];
    let alerts = scenario === "EMPTY" ? [] : [...alertSeed.filter((item) => item.id !== "alert-lab")];
    let pendingItems = scenario === "EMPTY" ? [] : [...pendingSeed.filter((item) => item.id !== "pending-lab")];
    let reviewPoints = scenario === "EMPTY" ? [] : [...reviewPointSeed.filter((item) => item.id !== "review-lab")];
    if (scenario !== "EMPTY" && laboratory.status !== "UPDATED") {
      alerts.push({ id: "alert-lab", title: laboratory.status === "NONE" ? "Exame laboratorial não disponível" : "Exame laboratorial antigo", description: laboratory.status === "NONE" ? "O prontuário não possui exame laboratorial ativo no mock." : "O exame disponível foi classificado como antigo somente pela data do registro.", level: "INFORMATIVE", area: "LABORATORY", source: "Exames Laboratoriais", status: "PENDING", createdAt: new Date().toISOString(), actionLabel: "Verificar exames" });
      pendingItems.push({ id: "pending-lab", description: laboratory.status === "NONE" ? "Verificar se existem exames laboratoriais a registrar." : "Confirmar se há exames laboratoriais mais recentes.", area: "LABORATORY", priority: "INFORMATIVE", reason: laboratory.status === "NONE" ? "Nenhum exame ativo foi localizado." : "A data do último exame excede o período demonstrativo de atualização.", possibleResponsible: "Profissional habilitado", suggestedAction: "Verificar disponibilidade documental", status: "PENDING" });
      reviewPoints.push({ id: "review-lab", title: "Verificar disponibilidade e atualidade dos exames", rationale: "A verificação considera somente existência e data, sem interpretar resultados.", evidenceIds: ["ev-lab"], area: "LABORATORY", relevance: "INFORMATIVE", status: "PENDING" });
    }
    if (!posturalCompleted) {
      alerts.push({ id: "alert-postural", title: "Avaliação Postural pendente", description: "O módulo especializado permanece disponível e não bloqueia o fluxo nutricional.", level: "INFORMATIVE", area: "POSTURAL_ASSESSMENT", source: "Coleta clínica", status: "PENDING", createdAt: "2026-07-16T10:24:00-03:00", actionLabel: "Abrir avaliação" });
      pendingItems.push({ id: "pending-postural", description: "Avaliação Postural ainda não concluída.", area: "POSTURAL_ASSESSMENT", priority: "INFORMATIVE", reason: "Pendência independente dos módulos clínicos de Nutrição.", possibleResponsible: "Saulo Xavier Vitorino ou Maria de Lourdes Gomes", suggestedAction: "Concluir quando o profissional decidir realizar o módulo", status: "PENDING" });
    }
    if (isMaria) {
      const visible = (area: ClinicalDecisionArea) => area !== "NUTRITION" && mariaAreas.includes(area);
      evidences = evidences.filter((item) => visible(item.area)); alerts = alerts.filter((item) => visible(item.area)); pendingItems = pendingItems.filter((item) => visible(item.area)); reviewPoints = reviewPoints.filter((item) => visible(item.area));
    }
    const workspace: ClinicalDecisionWorkspace = {
      patientId: collection.patientId, attendanceId: collection.attendanceId, masterRecordId: collection.masterRecordId, collectionScenario: collection.scenario, scenario,
      patient: { fullName: collection.patientName, code: collection.patientCode, age: 34 }, consultationTypeLabel: scenario === "POSTURAL_PENDING" ? "Atendimento Completo SV" : "Consulta inicial",
      responsibleProfessional: isMaria ? { professionalUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes, professionalName: "Maria de Lourdes Gomes", updatedAt: "2026-07-16T10:30:00-03:00", version: 1 } : collection.connectedProfessional, updatedAt: collection.connectedProfessional.updatedAt, attendanceStatus: posturalCompleted ? "Em análise profissional" : "Em análise profissional · Avaliação Postural pendente",
      evidences, alerts, pendingItems, reviewPoints, history: scenario === "COMPLETE" ? [previousDecisionSeed] : [],
      permissions: { canRead: true, canWrite: true, canViewNutrition: !isMaria, allowedDecisionAreas: isMaria ? mariaAreas : allAreas },
      posturalAssessmentRequired: true, posturalAssessmentCompleted: posturalCompleted,
    };
    return { ...workspace, history: readHistory(workspace) };
  },
  async saveDecision({ workspace, decision }) {
    if (!workspace.permissions.canWrite || !workspace.permissions.allowedDecisionAreas.includes(decision.area)) throw new Error("PERMISSION_DENIED");
    if (workspace.scenario === "SAVE_ERROR") throw new Error("MOCK_SAVE_ERROR");
    const saved: ProfessionalClinicalDecision = { ...decision, id: `decision-${Date.now()}`, patientId: workspace.patientId, professionalId: workspace.responsibleProfessional.professionalUserId, professionalName: workspace.responsibleProfessional.professionalName, createdAt: new Date().toISOString(), status: "DRAFT" };
    if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey(workspace), JSON.stringify([saved, ...workspace.history]));
    return { decision: saved, persisted: false };
  },
};
