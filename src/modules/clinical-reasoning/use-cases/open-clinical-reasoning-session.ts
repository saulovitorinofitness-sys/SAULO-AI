import type { AttendanceRepository } from "../../attendance";
import type { EntityId } from "../../shared";
import type { ClinicalReasoningSessionRepository } from "../repositories";
import type {
  ClinicalClockService,
  ClinicalProfessionalContextService,
  ClinicalReasoningAuthorizationService,
} from "../services";

export class ClinicalReasoningFlowError extends Error {
  constructor(
    readonly code: "ATTENDANCE_NOT_FOUND" | "SESSION_NOT_FOUND" | "EVIDENCE_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "ClinicalReasoningFlowError";
  }
}

export class OpenClinicalReasoningSessionUseCase {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly sessionRepository: ClinicalReasoningSessionRepository,
    private readonly professionalContext: ClinicalProfessionalContextService,
    private readonly clock: ClinicalClockService,
    private readonly authorization: ClinicalReasoningAuthorizationService,
  ) {}

  async execute(attendanceId: EntityId) {
    const existing = await this.sessionRepository.findByAttendanceId(attendanceId);
    if (existing) return existing;

    const attendance = await this.attendanceRepository.findById(attendanceId);
    if (!attendance) {
      throw new ClinicalReasoningFlowError("ATTENDANCE_NOT_FOUND", "Attendance was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanOpen(professionalUserId, attendance.id);

    return this.sessionRepository.create({
      attendanceId: attendance.id,
      professionalUserId,
      openedAt: this.clock.now(),
    });
  }
}
