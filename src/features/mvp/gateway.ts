import type { EntityId } from "@/modules/shared";
import type {
  AttendanceContinuityView,
  FrontendAccessSnapshot,
  MasterRecordSummaryView,
  PatientListItem,
  PatientRegistrationDraft,
  PatientSearchInput,
  SaveActivityInput,
  SaveActivityResult,
} from "./contracts";

export interface MvpFrontendGateway {
  getSession(): Promise<FrontendAccessSnapshot>;
  searchPatients(input: PatientSearchInput): Promise<readonly PatientListItem[]>;
  getPatientMasterRecord(patientId: EntityId): Promise<MasterRecordSummaryView | null>;
  getAttendanceContinuity(patientId: EntityId): Promise<AttendanceContinuityView | null>;
  registerPatient(input: PatientRegistrationDraft): Promise<{ patientId: EntityId; persisted: boolean }>;
  saveAttendanceActivity(input: SaveActivityInput): Promise<SaveActivityResult>;
}

export const REQUIRED_API_ENDPOINTS = [
  "GET /api/auth/session",
  "GET /api/patients?query={nome|cpf|telefone|codigo}",
  "POST /api/patients",
  "GET /api/patients/:patientId/master-record/summary",
  "GET /api/patients/:patientId/attendance/continuity",
  "POST /api/attendances/:attendanceId/activities",
] as const;
