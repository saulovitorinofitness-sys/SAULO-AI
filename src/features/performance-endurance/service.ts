import type { SessionUser } from "@/features/mvp";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { canOperatePerformance } from "@/features/professional-responsibility";

import { proposeAssistedWorkoutStructure } from "./assisted-workout";
import { performanceWorkoutRepository } from "./workout-repository";

export { proposeAssistedWorkoutStructure };
export type {
  AssistedWorkoutProposal,
  AssistedWorkoutProposalInput,
} from "./assisted-workout";

export const performanceEnduranceService = {
  canAccess(user: SessionUser) {
    return canOperatePerformance(user.id);
  },

  async getWorkout(user: SessionUser, patientId: string) {
    if (!this.canAccess(user)) return null;
    const attendanceId =
      await clinicalCollectionRepository.findOpenAttendanceId(patientId);
    if (!attendanceId) return null;
    return performanceWorkoutRepository.get(patientId, attendanceId, user.id);
  },
};
