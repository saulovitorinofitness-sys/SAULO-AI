import type { ClinicalDecisionScenario, ClinicalDecisionWorkspace, GetClinicalDecisionWorkspaceInput, ProfessionalClinicalDecision, SaveProfessionalDecisionInput } from "./contracts";

export interface ClinicalDecisionGateway {
  listScenarios(): Promise<readonly ClinicalDecisionScenario[]>;
  getWorkspace(input: GetClinicalDecisionWorkspaceInput): Promise<ClinicalDecisionWorkspace | null>;
  saveDecision(input: SaveProfessionalDecisionInput): Promise<{ readonly decision: ProfessionalClinicalDecision; readonly persisted: false }>;
}

export const REQUIRED_CLINICAL_DECISION_ENDPOINTS = [
  "GET /api/patients/:patientId/attendances/:attendanceId/clinical-decision",
  "POST /api/patients/:patientId/attendances/:attendanceId/clinical-decisions",
  "PATCH /api/patients/:patientId/attendances/:attendanceId/clinical-decisions/:decisionId",
  "POST /api/patients/:patientId/attendances/:attendanceId/clinical-review-points/:reviewPointId/review",
] as const;
