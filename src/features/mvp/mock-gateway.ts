import type { MvpFrontendGateway } from "./gateway";
import { mockContinuity, mockMasterRecord, mockPatients, mockSession } from "./mock-data";

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").replace(/\D/g, "");

export const mockMvpGateway: MvpFrontendGateway = {
  async getSession() {
    return mockSession;
  },
  async searchPatients({ query }) {
    if (!query?.trim()) return mockPatients;
    const text = query.trim().toLocaleLowerCase("pt-BR");
    const digits = normalize(query);
    return mockPatients.filter((item) =>
      item.patient.fullName.toLocaleLowerCase("pt-BR").includes(text)
      || item.code.toLocaleLowerCase("pt-BR").includes(text)
      || (digits.length > 0 && (normalize(item.primaryPhone).includes(digits) || (item.patient.cpf?.includes(digits) ?? false))),
    );
  },
  async getPatientMasterRecord(patientId) {
    return patientId === mockMasterRecord.patient.patient.id ? mockMasterRecord : null;
  },
  async getAttendanceContinuity(patientId) {
    return patientId === mockContinuity.patientId ? mockContinuity : null;
  },
  async saveAttendanceActivity() {
    return { savedAt: new Date().toISOString(), persisted: false };
  },
};
