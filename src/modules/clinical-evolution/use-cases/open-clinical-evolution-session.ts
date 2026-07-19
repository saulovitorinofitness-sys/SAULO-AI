import type { AttendanceRepository } from "../../attendance";
import type { MasterRecordRepository } from "../../master-record";
import type { PatientRepository } from "../../patients";
import type { EntityId } from "../../shared";
import type { ClinicalEvolutionSessionRepository } from "../repositories";
import type {
  ClinicalEvolutionAuthorizationService,
  EvolutionClockService,
  EvolutionProfessionalContextService,
} from "../services";

export class ClinicalEvolutionFlowError extends Error {
  constructor(
    readonly code:
      | "PATIENT_NOT_FOUND"
      | "MASTER_RECORD_NOT_FOUND"
      | "ATTENDANCE_NOT_FOUND"
      | "MASTER_RECORD_MISMATCH"
      | "EVOLUTION_SESSION_NOT_FOUND"
      | "PROTOCOL_NOT_FOUND"
      | "EVIDENCE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "ClinicalEvolutionFlowError";
  }
}

export interface OpenClinicalEvolutionSessionInput {
  readonly patientId: EntityId;
  readonly attendanceId: EntityId;
}

export class OpenClinicalEvolutionSessionUseCase {
  constructor(
    private readonly patientRepository: PatientRepository,
    private readonly masterRecordRepository: MasterRecordRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly evolutionRepository: ClinicalEvolutionSessionRepository,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly clock: EvolutionClockService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(input: OpenClinicalEvolutionSessionInput) {
    const existing = await this.evolutionRepository.findByAttendanceId(input.attendanceId);
    if (existing) return existing;

    const patient = await this.patientRepository.findById(input.patientId);
    if (!patient) {
      throw new ClinicalEvolutionFlowError("PATIENT_NOT_FOUND", "Patient was not found.");
    }

    const masterRecord = await this.masterRecordRepository.findByPatientId(patient.id);
    if (!masterRecord) {
      throw new ClinicalEvolutionFlowError("MASTER_RECORD_NOT_FOUND", "Master Record was not found.");
    }

    const attendance = await this.attendanceRepository.findById(input.attendanceId);
    if (!attendance) {
      throw new ClinicalEvolutionFlowError("ATTENDANCE_NOT_FOUND", "Attendance was not found.");
    }

    if (attendance.masterRecordId !== masterRecord.id) {
      throw new ClinicalEvolutionFlowError("MASTER_RECORD_MISMATCH", "Attendance and patient do not share the same Master Record.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanOpen(professionalUserId, masterRecord.id);
    const previousSession = await this.evolutionRepository.findLatestByMasterRecordId(masterRecord.id);

    return this.evolutionRepository.create({
      patientId: patient.id,
      masterRecordId: masterRecord.id,
      attendanceId: attendance.id,
      professionalUserId,
      previousSessionId: previousSession?.id,
      evaluatedAt: this.clock.now(),
    });
  }
}
