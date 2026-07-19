import type { MasterRecordRepository } from "../../master-record";
import type { PatientRepository } from "../../patients";
import type { EntityId, JsonValue } from "../../shared";
import type { ConsultationType } from "../domain";
import type { AttendanceRepository, IntelligentAttendanceAggregate, TimelineEventDraft } from "../repositories";
import type {
  AttendanceAuthorizationService,
  ClinicalSummaryService,
  ClockService,
  PendingVerificationService,
  ProfessionalContextService,
} from "../services";

export interface StartIntelligentAttendanceInput {
  readonly patientId: EntityId;
  readonly appointmentId?: EntityId;
  readonly consultationType: ConsultationType;
  readonly idempotencyKey: string;
}

export interface StartIntelligentAttendanceOutput {
  readonly aggregate: IntelligentAttendanceAggregate;
  readonly reusedExistingAttendance: boolean;
}

export class AttendanceFlowError extends Error {
  constructor(
    readonly code: "PATIENT_NOT_FOUND" | "MASTER_RECORD_NOT_FOUND" | "ATTENDANCE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "AttendanceFlowError";
  }
}

export class StartIntelligentAttendanceUseCase {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly patientRepository: PatientRepository,
    private readonly masterRecordRepository: MasterRecordRepository,
    private readonly professionalContext: ProfessionalContextService,
    private readonly clock: ClockService,
    private readonly authorization: AttendanceAuthorizationService,
    private readonly pendingVerification: PendingVerificationService,
    private readonly clinicalSummary: ClinicalSummaryService,
  ) {}

  async execute(input: StartIntelligentAttendanceInput): Promise<StartIntelligentAttendanceOutput> {
    const existing = await this.attendanceRepository.findAggregateByIdempotencyKey(input.idempotencyKey);

    if (existing) {
      return { aggregate: existing, reusedExistingAttendance: true };
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanStart(professionalUserId, input.consultationType);

    const patient = await this.patientRepository.findById(input.patientId);
    if (!patient) {
      throw new AttendanceFlowError("PATIENT_NOT_FOUND", "Patient was not found.");
    }

    const masterRecord = await this.masterRecordRepository.findByPatientId(patient.id);
    if (!masterRecord) {
      throw new AttendanceFlowError("MASTER_RECORD_NOT_FOUND", "Patient does not have a Master Record.");
    }

    const pendingCheck = await this.pendingVerification.verify(masterRecord.id);
    const summary = await this.clinicalSummary.prepare(masterRecord.id);
    const receivedAt = this.clock.now();

    const timeline = this.createPreparationTimeline(
      receivedAt,
      input.consultationType,
      masterRecord.id,
      pendingCheck.pendingStepIds,
      summary.entryIds,
    );

    const aggregate = await this.attendanceRepository.createIntelligentAttendance({
      masterRecordId: masterRecord.id,
      appointmentId: input.appointmentId,
      professionalUserId,
      consultationType: input.consultationType,
      currentStage: "IN_PROGRESS",
      status: "IN_PROGRESS",
      idempotencyKey: input.idempotencyKey,
      receivedAt,
      startedAt: receivedAt,
      continuityId: pendingCheck.continuityId,
      continuityVersion: pendingCheck.continuityVersion,
      pendingStepIds: pendingCheck.pendingStepIds,
      masterRecordVersion: summary.masterRecordVersion,
      summaryEntryIds: summary.entryIds,
      timeline,
    });

    return { aggregate, reusedExistingAttendance: false };
  }

  private createPreparationTimeline(
    occurredAt: string,
    consultationType: ConsultationType,
    masterRecordId: EntityId,
    pendingStepIds: readonly EntityId[],
    summaryEntryIds: readonly EntityId[],
  ): readonly TimelineEventDraft[] {
    const drafts: Array<[TimelineEventDraft["type"], JsonValue]> = [
      ["PATIENT_RECEIVED", {}],
      ["MASTER_RECORD_LOADED", { masterRecordId }],
      ["PENDENCIES_VERIFIED", { pendingStepIds: [...pendingStepIds] }],
      ["CLINICAL_SUMMARY_PREPARED", { entryIds: [...summaryEntryIds] }],
      ["CONSULTATION_TYPE_RECORDED", { consultationType }],
      ["ATTENDANCE_STARTED", {}],
    ];

    return drafts.map(([type, payload], index) => ({
      type,
      sequence: index + 1,
      occurredAt,
      payload,
    }));
  }
}
