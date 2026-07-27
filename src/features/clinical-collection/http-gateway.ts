import type { ClinicalCollectionGateway } from "./gateway";
import { developmentUserRequestHeaders } from "@/features/development-session";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...developmentUserRequestHeaders(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`ASSESSMENT_REQUEST_FAILED:${response.status}`);
  }

  return (await response.json()) as T;
}

export const httpClinicalCollectionGateway: ClinicalCollectionGateway = {
  async listScenarios() {
    return [
      {
        key: "complete",
        label: "Avaliação atual",
        description: "Dados persistidos no Prontuário Mestre.",
      },
    ];
  },

  async getCollection({ patientId, attendanceId }) {
    const response = await fetch(
      `/api/patients/${patientId}/attendances/${attendanceId}/clinical-collection`,
      { headers: developmentUserRequestHeaders() },
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`ASSESSMENT_REQUEST_FAILED:${response.status}`);
    }

    return response.json();
  },

  async saveStep(input) {
    return requestJson(
      `/api/patients/${input.patientId}/attendances/${input.attendanceId}/clinical-collection/${input.step}`,
      {
        method: "PUT",
        body: JSON.stringify({ data: input.data }),
      },
    );
  },

  async completeCollection(input) {
    return requestJson(
      `/api/patients/${input.patientId}/attendances/${input.attendanceId}/clinical-collection/complete`,
      { method: "POST" },
    );
  },

  async getCurrentAttendance() {
    return null;
  },

  async getClinicalPanel() {
    return null;
  },

  async updateClinicalPanel() {
    throw new Error("CLINICAL_PANEL_NOT_AVAILABLE");
  },
};
