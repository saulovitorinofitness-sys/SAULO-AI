import type {
  ClinicalCollectionScenario,
  ClinicalCollectionView,
  CompleteClinicalCollectionResult,
  GetClinicalCollectionInput,
  CurrentAttendanceView,
  ClinicalPanelView,
  SaveClinicalStepInput,
  SaveClinicalStepResult,
  UpdateClinicalPanelInput,
  UpdateClinicalPanelResult,
} from "./contracts";

export interface ClinicalCollectionGateway {
  listScenarios(): Promise<readonly ClinicalCollectionScenario[]>;
  getCollection(input: GetClinicalCollectionInput): Promise<ClinicalCollectionView | null>;
  saveStep(input: SaveClinicalStepInput): Promise<SaveClinicalStepResult>;
  completeCollection(input: GetClinicalCollectionInput): Promise<CompleteClinicalCollectionResult>;
  getCurrentAttendance(input: GetClinicalCollectionInput): Promise<CurrentAttendanceView | null>;
  getClinicalPanel(input: GetClinicalCollectionInput): Promise<ClinicalPanelView | null>;
  updateClinicalPanel(input: UpdateClinicalPanelInput): Promise<UpdateClinicalPanelResult>;
}

export const REQUIRED_CLINICAL_COLLECTION_ENDPOINTS = [
  "GET /api/patients/:patientId/attendances/:attendanceId/clinical-collection",
  "PUT /api/patients/:patientId/attendances/:attendanceId/clinical-collection/:step",
  "POST /api/patients/:patientId/attendances/:attendanceId/clinical-collection/complete",
  "GET /api/patients/:patientId/attendances/:attendanceId/progress",
  "GET /api/patients/:patientId/attendances/:attendanceId/clinical-panel",
  "POST /api/patients/:patientId/attendances/:attendanceId/clinical-panel/confirm",
  "POST /api/patients/:patientId/attendances/:attendanceId/clinical-panel/continue",
] as const;
