import type { EntityId, ModuleKey } from "../../shared";
import type { AttendanceRepository, AttendanceTimelineRepository } from "../repositories";
import type { AttendanceAuthorizationService, ClockService, ProfessionalContextService } from "../services";
import { AttendanceFlowError } from "./start-intelligent-attendance";

export interface RecordAttendanceActivityInput {
  readonly attendanceId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly referenceType: string;
  readonly referenceId: EntityId;
}

export class RecordAttendanceActivityUseCase {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly timelineRepository: AttendanceTimelineRepository,
    private readonly professionalContext: ProfessionalContextService,
    private readonly clock: ClockService,
    private readonly authorization: AttendanceAuthorizationService,
  ) {}

  async execute(input: RecordAttendanceActivityInput): Promise<void> {
    const attendance = await this.attendanceRepository.findById(input.attendanceId);
    if (!attendance) {
      throw new AttendanceFlowError("ATTENDANCE_NOT_FOUND", "Attendance was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanRecordActivity(professionalUserId, attendance.id, input.moduleKey);

    await this.timelineRepository.appendActivity(attendance.id, {
      moduleKey: input.moduleKey,
      actorUserId: professionalUserId,
      occurredAt: this.clock.now(),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    });
  }
}
