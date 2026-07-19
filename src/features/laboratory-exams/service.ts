import type { LaboratoryExamAvailability, LaboratoryExamRecord, LaboratoryExamsView, GetLaboratoryExamsInput, RemoveLaboratoryExamInput, SaveLaboratoryExamInput } from "./contracts";
import { laboratoryExamMockView, laboratoryExamProfessional } from "./mock-data";

const memory = new Map<string, LaboratoryExamsView>();
const storageKey = (patientId: string) => `saulo-ai:laboratory-exams:${patientId}`;
const clone = <T,>(value: T): T => structuredClone(value);

function read(patientId: string): LaboratoryExamsView {
  const stored = memory.get(patientId);
  if (stored) return stored;
  if (typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(storageKey(patientId));
    if (raw) return JSON.parse(raw) as LaboratoryExamsView;
  }
  return { ...clone(laboratoryExamMockView), patientId };
}

function store(view: LaboratoryExamsView) {
  memory.set(view.patientId, view);
  if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey(view.patientId), JSON.stringify(view));
}

function withViewer(view: LaboratoryExamsView, scenario: GetLaboratoryExamsInput["scenario"]): LaboratoryExamsView {
  const professional = laboratoryExamProfessional(scenario);
  return { ...view, scenario, connectedProfessionalName: professional.name, canRead: true, canEdit: true };
}

export function summarizeLaboratoryExamAvailability(records: readonly LaboratoryExamRecord[], today = new Date()): LaboratoryExamAvailability {
  const active = records.filter((record) => record.status === "ACTIVE");
  if (!active.length) return { status: "NONE", exists: false, activeExamCount: 0 };
  const latestCollectedAt = active.reduce((latest, record) => record.collectedAt > latest ? record.collectedAt : latest, active[0].collectedAt);
  const ageInDays = Math.floor((today.getTime() - new Date(`${latestCollectedAt}T12:00:00`).getTime()) / 86_400_000);
  return { status: ageInDays > 180 ? "OLD" : "UPDATED", exists: true, latestCollectedAt, activeExamCount: active.length };
}

export const laboratoryExamsService = {
  async get(input: GetLaboratoryExamsInput) {
    if (input.patientId !== "demo-patient-001") return null;
    return clone(withViewer(read(input.patientId), input.scenario));
  },
  async save(input: SaveLaboratoryExamInput) {
    const current = read(input.patientId); const professional = laboratoryExamProfessional(input.scenario); const now = new Date().toISOString();
    const existing = input.examId ? current.records.find((record) => record.id === input.examId) : undefined;
    const record: LaboratoryExamRecord = existing
      ? { ...existing, ...input.data, version: existing.version + 1, updatedAt: now, recordedBy: professional.name }
      : { ...input.data, id: `lab-${Date.now()}`, masterRecordId: current.masterRecordId, patientId: current.patientId, status: "ACTIVE", version: 1, createdAt: now, updatedAt: now, recordedBy: professional.name };
    const records = existing ? current.records.map((item) => item.id === existing.id ? record : item) : [record, ...current.records];
    const history = [{ id: `history-${Date.now()}`, examId: record.id, action: existing ? "UPDATED" as const : "CREATED" as const, occurredAt: now, professionalName: professional.name, summary: `${record.name} ${existing ? "atualizado" : "adicionado"} no mock.`, previousRecord: existing }, ...current.history];
    const view = withViewer({ ...current, records, history }, input.scenario); store(view); return { view: clone(view), persisted: false as const };
  },
  async remove(input: RemoveLaboratoryExamInput) {
    const current = read(input.patientId); const professional = laboratoryExamProfessional(input.scenario); const now = new Date().toISOString(); const existing = current.records.find((record) => record.id === input.examId);
    if (!existing) throw new Error("EXAM_NOT_FOUND");
    const removed = { ...existing, status: "REMOVED" as const, version: existing.version + 1, updatedAt: now, recordedBy: professional.name };
    const view = withViewer({ ...current, records: current.records.map((record) => record.id === input.examId ? removed : record), history: [{ id: `history-${Date.now()}`, examId: existing.id, action: "REMOVED", occurredAt: now, professionalName: professional.name, summary: `${existing.name} removido da visualização ativa; versão anterior preservada.`, previousRecord: existing }, ...current.history] }, input.scenario);
    store(view); return { view: clone(view), persisted: false as const };
  },
  async getAvailability(input: GetLaboratoryExamsInput) {
    return summarizeLaboratoryExamAvailability(read(input.patientId).records);
  },
};

