import { BUILT_IN_ACCESS_POLICIES, BUILT_IN_IDS } from "@/modules/permissions";
import type { AttendanceContinuityView, FrontendAccessSnapshot, MasterRecordSummaryView, PatientListItem } from "./contracts";

export const DEMO_PATIENT_ID = "demo-patient-001";
export const DEMO_ATTENDANCE_ID = "demo-attendance-001";

const patient: PatientListItem = {
  patient: { id: DEMO_PATIENT_ID, fullName: "Paciente de demonstração", cpf: "00000000000", status: "ACTIVE" },
  code: "DEMO-001",
  age: 34,
  primaryPhone: "(00) 00000-0000",
  lastAttendanceAt: "2026-07-15T17:30:00-03:00",
  nextPendingStep: "Revisar dados compartilhados",
  masterRecordId: "demo-master-record-001",
  completionPercentage: 35,
  openAttendanceId: DEMO_ATTENDANCE_ID,
};

const completedStep = {
  id: "demo-step-001",
  key: "PATIENT_RECEPTION",
  title: "Recepção e identificação",
  moduleKey: "ATTENDANCE" as const,
  status: "COMPLETED" as const,
  completedAt: "2026-07-15T17:30:00-03:00",
};

const pendingSteps = [
  {
    id: "demo-step-002",
    key: "SHARED_DATA_REVIEW",
    title: "Revisar dados compartilhados",
    moduleKey: "MASTER_RECORD" as const,
    status: "PENDING" as const,
  },
  {
    id: "demo-step-003",
    key: "ATTENDANCE_ACTIVITY",
    title: "Registrar atividade do atendimento",
    moduleKey: "ATTENDANCE" as const,
    status: "PENDING" as const,
  },
] as const;

export const mockSession: FrontendAccessSnapshot = {
  user: {
    id: BUILT_IN_IDS.users.sauloXavierVitorino,
    fullName: "Saulo Xavier Vitorino",
    email: "saulo@saulo-ai.local",
    status: "ACTIVE",
    roleName: "Acesso total",
  },
  grantsAllModules: true,
  allowsNutritionModules: true,
  overrides: BUILT_IN_ACCESS_POLICIES.sauloXavierVitorino.overrides,
};

export const mockPatients: readonly PatientListItem[] = [patient];

export const mockMasterRecord: MasterRecordSummaryView = {
  patient,
  birthDate: "1992-02-10",
  cpfMasked: "***.***.***-**",
  email: "paciente.demo@example.invalid",
  alerts: [],
  responsibleProfessionalName: "Saulo Xavier Vitorino",
  lastActivityAt: "2026-07-15T17:30:00-03:00",
  lastConsultationType: "INITIAL",
  completedSteps: [completedStep],
  pendingSteps,
  nextSuggestedStep: pendingSteps[0],
  timeline: [
    {
      id: "demo-timeline-001",
      title: "Cadastro compartilhado disponibilizado",
      detail: "Referência vinculada ao Prontuário Mestre.",
      occurredAt: "2026-07-15T16:50:00-03:00",
      actorName: "Saulo Xavier Vitorino",
    },
    {
      id: "demo-timeline-002",
      title: "Recepção concluída",
      occurredAt: "2026-07-15T17:30:00-03:00",
      actorName: "Saulo Xavier Vitorino",
    },
  ],
};

export const mockContinuity: AttendanceContinuityView = {
  id: DEMO_ATTENDANCE_ID,
  patientId: DEMO_PATIENT_ID,
  patientName: patient.patient.fullName,
  masterRecordId: patient.masterRecordId,
  professionalName: "Saulo Xavier Vitorino",
  consultationType: "INITIAL",
  lastCompletedStep: completedStep,
  pendingSteps,
  lastActivityAt: "2026-07-15T17:30:00-03:00",
};
