import { BUILT_IN_IDS } from "@/modules/permissions";

export function canOperatePosturalAssessment(userId: string) {
  return userId === BUILT_IN_IDS.users.mariaDeLourdesGomes;
}
