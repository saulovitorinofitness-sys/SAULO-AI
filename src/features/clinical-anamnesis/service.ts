import { BUILT_IN_IDS } from "@/modules/permissions";

import type {
  ClinicalAnamnesisView,
  GetClinicalAnamnesisInput,
  SaveClinicalAnamnesisInput,
} from "./contracts";
import { createAnamnesisSeed } from "./mock-data";

const DEMO_PATIENT_ID = "demo-patient-001";
const memory = new Map<string, ClinicalAnamnesisView>();
const key = (patientId: string) =>
  `saulo-ai:clinical-anamnesis:${patientId}`;
const isMariaScenario = (scenario: string) =>
  scenario === "maria-continuity" ||
  scenario === "previous-comparison";

function readDemo(patientId: string) {
  if (typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(key(patientId));
    if (raw) return JSON.parse(raw) as ClinicalAnamnesisView;
  }
  return memory.get(patientId) ?? createAnamnesisSeed();
}

function storeDemo(view: ClinicalAnamnesisView) {
  memory.set(view.patientId, view);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(key(view.patientId), JSON.stringify(view));
  }
}

function withViewer(view: ClinicalAnamnesisView, scenario: string) {
  const maria = isMariaScenario(scenario);
  return {
    ...view,
    scenario: scenario as ClinicalAnamnesisView["scenario"],
    canViewNutrition: !maria,
    audit: maria
      ? {
          ...view.audit,
          professionalUserId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
          professionalName: "Maria de Lourdes Gomes",
        }
      : view.audit,
  };
}

async function getPersisted(input: GetClinicalAnamnesisInput) {
  if (typeof window === "undefined") return null;
  const response = await fetch(
    `/api/patients/${encodeURIComponent(input.patientId)}/clinical-objectives?scenario=${encodeURIComponent(input.scenario)}`,
  );
  if (!response.ok) return null;
  const result = (await response.json()) as {
    view?: ClinicalAnamnesisView;
  };
  return result.view ?? null;
}

export const clinicalAnamnesisService = {
  async get(input: GetClinicalAnamnesisInput) {
    if (input.patientId !== DEMO_PATIENT_ID) {
      return getPersisted(input);
    }
    return withViewer(readDemo(input.patientId), input.scenario);
  },

  async save(input: SaveClinicalAnamnesisInput) {
    if (input.patientId !== DEMO_PATIENT_ID) {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(input.patientId)}/clinical-objectives?scenario=${encodeURIComponent(input.scenario)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: input.data }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        view?: ClinicalAnamnesisView;
        message?: string;
      } | null;
      if (!response.ok || !result?.view) {
        throw new Error(result?.message ?? "Não foi possível salvar a anamnese clínica.");
      }
      return {
        view: result.view,
        persisted: true as const,
      };
    }

    const current = readDemo(input.patientId);
    const maria = isMariaScenario(input.scenario);
    const updatedAt = new Date().toISOString();
    const professionalName = maria
      ? "Maria de Lourdes Gomes"
      : "Saulo Xavier Vitorino";
    const professionalUserId = maria
      ? BUILT_IN_IDS.users.mariaDeLourdesGomes
      : BUILT_IN_IDS.users.sauloXavierVitorino;
    const next: ClinicalAnamnesisView = {
      ...current,
      scenario: input.scenario,
      status: "COMPLETED",
      version: current.version + 1,
      data: maria
        ? { ...input.data, nutrition: current.data.nutrition }
        : input.data,
      audit: {
        professionalUserId,
        professionalName,
        updatedAt,
        version: current.version + 1,
      },
      history: [
        {
          id: `anamnesis-history-${Date.now()}`,
          version: current.version,
          changedAt: current.audit.updatedAt,
          changedBy: current.audit.professionalName,
          summary: "Versão anterior preservada antes da edição mockada.",
          data: current.data,
        },
        ...current.history,
      ],
      timeline: [
        ...current.timeline,
        {
          id: `anamnesis-timeline-${Date.now()}`,
          occurredAt: updatedAt,
          actorName: professionalName,
          title: "Anamnese atualizada",
          detail: `Versão ${current.version + 1} salva no estado mockado.`,
        },
      ],
      canRead: true,
      canEdit: true,
      canViewNutrition: !maria,
    };
    storeDemo(next);
    return { view: structuredClone(next), persisted: false as const };
  },
};
