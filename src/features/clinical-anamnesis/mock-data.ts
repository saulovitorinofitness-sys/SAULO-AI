import { BUILT_IN_IDS } from "@/modules/permissions";
import type { ClinicalAnamnesisData, ClinicalAnamnesisView } from "./contracts";

export const objectiveOptions = [
  ["WEIGHT_LOSS", "Emagrecimento"], ["HYPERTROPHY", "Hipertrofia"], ["REHABILITATION", "Reabilitação"], ["HEALTH", "Saúde"], ["PERFORMANCE", "Performance"], ["CONDITIONING", "Condicionamento"], ["OTHER", "Outro"],
] as const;
export const clinicalHistoryOptions = [["HYPERTENSION", "Hipertensão"], ["DIABETES", "Diabetes"], ["DYSLIPIDEMIA", "Dislipidemia"], ["HEART_DISEASE", "Doença Cardíaca"], ["THYROID", "Tireoide"], ["OSTEOPOROSIS", "Osteoporose"], ["HERNIA", "Hérnia"], ["ARTHROSIS", "Artrose"], ["ARTHRITIS", "Artrite"], ["ASTHMA", "Asma"], ["COPD", "DPOC"], ["ANXIETY", "Ansiedade"], ["DEPRESSION", "Depressão"], ["OTHER", "Outro"]] as const;
export const familyHistoryOptions = [["DIABETES", "Diabetes"], ["HYPERTENSION", "Hipertensão"], ["OBESITY", "Obesidade"], ["HEART_ATTACK", "Infarto"], ["STROKE", "AVC"], ["CANCER", "Câncer"], ["OSTEOPOROSIS", "Osteoporose"], ["OTHER", "Outro"]] as const;

export const emptyAnamnesisData: ClinicalAnamnesisData = {
  chiefComplaint: "Registro demonstrativo para validação do fluxo da anamnese.",
  currentIllness: { onset: "", duration: "", evolution: "", previousTreatments: "", currentSituation: "" },
  primaryObjective: "HEALTH", secondaryObjectives: [], clinicalHistory: [], clinicalHistoryNotes: "", familyHistory: [], surgeries: [], injuries: [], medications: [], supplements: [], allergies: [],
  sleep: { hours: "", quality: "", awakenings: "" }, stressLevel: 0,
  physicalActivity: { frequency: "", duration: "", modality: "" }, habits: { alcohol: "", smoking: "", others: "" }, nutrition: { mealsPerDay: "", water: "", restrictions: "", preferences: "" }, generalNotes: "",
};

export function createAnamnesisSeed(): ClinicalAnamnesisView {
  return { patientId: "demo-patient-001", masterRecordId: "demo-master-record-001", patientName: "Paciente de demonstração", patientCode: "DEMO-001", scenario: "complete", status: "COMPLETED", version: 1, data: structuredClone(emptyAnamnesisData), audit: { professionalUserId: BUILT_IN_IDS.users.sauloXavierVitorino, professionalName: "Saulo Xavier Vitorino", updatedAt: "2026-07-16T14:10:00-03:00", version: 1 }, history: [], timeline: [{ id: "anamnesis-timeline-001", occurredAt: "2026-07-16T14:10:00-03:00", actorName: "Saulo Xavier Vitorino", title: "Anamnese registrada", detail: "Registro mockado vinculado ao Prontuário Mestre." }], canRead: true, canEdit: true, canViewNutrition: true };
}
