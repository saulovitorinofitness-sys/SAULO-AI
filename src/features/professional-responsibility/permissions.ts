import { BUILT_IN_IDS } from "@/modules/permissions";

export function canOperatePosturalAssessment(userId: string) {
  return (
    userId === BUILT_IN_IDS.users.sauloXavierVitorino ||
    userId === BUILT_IN_IDS.users.mariaDeLourdesGomes
  );
}

export function canOperatePerformance(userId: string) {
  return (
    userId === BUILT_IN_IDS.users.sauloXavierVitorino ||
    userId === BUILT_IN_IDS.users.mariaDeLourdesGomes
  );
}
