import type { SessionUser } from "@/features/mvp";
import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { BUILT_IN_IDS } from "@/modules/permissions";

import { performanceWorkoutRepository } from "./workout-repository";

export const performanceEnduranceService = {
  canAccess(user: SessionUser) {
    return user.id === BUILT_IN_IDS.users.sauloXavierVitorino;
  },

  async getWorkout(user: SessionUser, patientId: string) {
    if (!this.canAccess(user)) return null;
    const attendanceId =
      await clinicalCollectionRepository.findOpenAttendanceId(patientId);
    if (!attendanceId) return null;
    return performanceWorkoutRepository.get(patientId, attendanceId);
  },
};
