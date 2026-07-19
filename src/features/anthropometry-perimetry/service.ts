import { clinicalCollectionService } from "@/features/clinical-collection";
import { BUILT_IN_IDS } from "@/modules/permissions";
import type { AnthropometryPerimetryView, AnthropometryScenarioKey, GetAnthropometryPerimetryInput, SaveAnthropometryAssessmentInput } from "./contracts";
import { buildAnthropometryMockAssessments } from "./mock-data";

const memory = new Map<string, AnthropometryPerimetryView>();
const key = (patientId: string, scenario: AnthropometryScenarioKey) => `${patientId}:${scenario}`;
const storageKey = (patientId: string, scenario: AnthropometryScenarioKey) => `saulo-ai:anthropometry-perimetry:${patientId}:${scenario}`;
const clone = <T,>(value: T): T => structuredClone(value);
const deriveScenario = (scenario: GetAnthropometryPerimetryInput["scenario"]): AnthropometryScenarioKey => scenario === "partial-saulo" || scenario === "mandatory-pending" || scenario === "integrity-missing" ? "PARTIAL" : scenario === "previous-comparison" ? "REASSESSMENT" : "COMPLETE";

function stored(patientId: string, scenario: AnthropometryScenarioKey) {
  const cached = memory.get(key(patientId, scenario)); if (cached) return cached;
  if (typeof window === "undefined") return undefined;
  const raw = window.sessionStorage.getItem(storageKey(patientId, scenario)); return raw ? JSON.parse(raw) as AnthropometryPerimetryView : undefined;
}
function store(view: AnthropometryPerimetryView) { memory.set(key(view.patientId, view.scenario), view); if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey(view.patientId, view.scenario), JSON.stringify(view)); }

export const anthropometryPerimetryService = {
  async get(input: GetAnthropometryPerimetryInput) {
    const scenario = deriveScenario(input.scenario); const cached = stored(input.patientId, scenario); if (cached) return clone(cached);
    const collection = await clinicalCollectionService.getCollection(input); if (!collection) return null;
    const seeded = buildAnthropometryMockAssessments(collection, scenario); const assessments = input.scenario === "not-started" ? [{ ...seeded[0], status: "NOT_STARTED" as const, measurements: seeded[0].measurements.map((item) => ({ ...item, valueCm: undefined, notPerformed: false, reason: undefined })) }, ...seeded.slice(1)] : seeded; const view: AnthropometryPerimetryView = { patientId: collection.patientId, patientName: collection.patientName, patientCode: collection.patientCode, masterRecordId: collection.masterRecordId, attendanceId: collection.attendanceId, collectionScenario: input.scenario, scenario, currentAssessment: assessments[0], assessments, connectedProfessional: collection.connectedProfessional, canRead: true, canEdit: true };
    return clone(view);
  },
  async save(input: SaveAnthropometryAssessmentInput) {
    const current = await this.get(input); if (!current) throw new Error("ASSESSMENT_NOT_FOUND"); const now = new Date().toISOString(); const maria = input.scenario === "maria-continuity" || input.scenario === "previous-comparison"; const professionalName = maria ? "Maria de Lourdes Gomes" : "Saulo Xavier Vitorino"; const professionalId = maria ? BUILT_IN_IDS.users.mariaDeLourdesGomes : BUILT_IN_IDS.users.sauloXavierVitorino;
    const status = input.action === "START" || input.action === "SAVE_DRAFT" ? "IN_PROGRESS" as const : input.action === "COMPLETE" ? "COMPLETED" as const : "REVIEWED" as const;
    const assessment = { ...input.assessment, status, professionalName, professionalId, updatedAt: now, version: input.assessment.version + 1 };
    const assessments = [assessment, ...current.assessments.filter((item) => item.id !== assessment.id)]; const view = { ...current, currentAssessment: assessment, assessments, connectedProfessional: { professionalUserId: professionalId, professionalName, updatedAt: now, version: current.connectedProfessional.version + 1 } };
    store(view); return { view: clone(view), persisted: false as const };
  },
};
