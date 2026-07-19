import { BUILT_IN_IDS } from "@/modules/permissions";
import type { ClinicalAnamnesisView, GetClinicalAnamnesisInput, SaveClinicalAnamnesisInput } from "./contracts";
import { createAnamnesisSeed } from "./mock-data";

const memory = new Map<string, ClinicalAnamnesisView>();
const key = (patientId: string) => `saulo-ai:clinical-anamnesis:${patientId}`;
const isMariaScenario = (scenario: string) => scenario === "maria-continuity" || scenario === "previous-comparison";
function read(patientId: string) { if (typeof window !== "undefined") { const raw = window.sessionStorage.getItem(key(patientId)); if (raw) return JSON.parse(raw) as ClinicalAnamnesisView; } return memory.get(patientId) ?? createAnamnesisSeed(); }
function store(view: ClinicalAnamnesisView) { memory.set(view.patientId, view); if (typeof window !== "undefined") window.sessionStorage.setItem(key(view.patientId), JSON.stringify(view)); }
function withViewer(view: ClinicalAnamnesisView, scenario: string): ClinicalAnamnesisView { const maria = isMariaScenario(scenario); return { ...view, scenario: scenario as ClinicalAnamnesisView["scenario"], canViewNutrition: !maria, audit: maria ? { ...view.audit, professionalUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes, professionalName: "Maria de Lourdes Gomes" } : view.audit }; }

export const clinicalAnamnesisService = {
  async get(input: GetClinicalAnamnesisInput) { if (input.patientId !== "demo-patient-001") return null; return withViewer(structuredClone(read(input.patientId)), input.scenario); },
  async save(input: SaveClinicalAnamnesisInput) {
    const current = read(input.patientId); const maria = isMariaScenario(input.scenario); const updatedAt = new Date().toISOString(); const professionalName = maria ? "Maria de Lourdes Gomes" : "Saulo Xavier Vitorino"; const professionalUserId = maria ? BUILT_IN_IDS.users.mariaDeLourdesGomes : BUILT_IN_IDS.users.sauloXavierVitorino;
    const next: ClinicalAnamnesisView = { ...current, scenario: input.scenario, status: "COMPLETED", version: current.version + 1, data: maria ? { ...input.data, nutrition: current.data.nutrition } : input.data, audit: { professionalUserId, professionalName, updatedAt, version: current.version + 1 }, history: [{ id: `anamnesis-history-${Date.now()}`, version: current.version, changedAt: current.audit.updatedAt, changedBy: current.audit.professionalName, summary: "Versão anterior preservada antes da edição mockada.", data: current.data }, ...current.history], timeline: [...current.timeline, { id: `anamnesis-timeline-${Date.now()}`, occurredAt: updatedAt, actorName: professionalName, title: "Anamnese atualizada", detail: `Versão ${current.version + 1} salva no estado mockado.` }], canRead: true, canEdit: true, canViewNutrition: !maria };
    store(next); return { view: structuredClone(next), persisted: false as const };
  },
};
