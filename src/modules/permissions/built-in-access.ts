import type { UserAccessPolicy } from "./domain";

const nutritionDenyOverrides = [
  { moduleKey: "MEAL_PLAN", action: "READ", effect: "DENY" },
  { moduleKey: "MEAL_PLAN", action: "CREATE", effect: "DENY" },
  { moduleKey: "MEAL_PLAN", action: "UPDATE", effect: "DENY" },
  { moduleKey: "MEAL_PLAN", action: "DELETE", effect: "DENY" },
  { moduleKey: "MEAL_PLAN", action: "EXPORT", effect: "DENY" },
  { moduleKey: "MEAL_PLAN", action: "MANAGE", effect: "DENY" },
  { moduleKey: "NUTRITION_STRATEGY", action: "READ", effect: "DENY" },
  { moduleKey: "NUTRITION_STRATEGY", action: "CREATE", effect: "DENY" },
  { moduleKey: "NUTRITION_STRATEGY", action: "UPDATE", effect: "DENY" },
  { moduleKey: "NUTRITION_STRATEGY", action: "DELETE", effect: "DENY" },
  { moduleKey: "NUTRITION_STRATEGY", action: "EXPORT", effect: "DENY" },
  { moduleKey: "NUTRITION_STRATEGY", action: "MANAGE", effect: "DENY" },
  { moduleKey: "NUTRITION_EVOLUTION", action: "READ", effect: "DENY" },
  { moduleKey: "NUTRITION_EVOLUTION", action: "CREATE", effect: "DENY" },
  { moduleKey: "NUTRITION_EVOLUTION", action: "UPDATE", effect: "DENY" },
  { moduleKey: "NUTRITION_EVOLUTION", action: "DELETE", effect: "DENY" },
  { moduleKey: "NUTRITION_EVOLUTION", action: "EXPORT", effect: "DENY" },
  { moduleKey: "NUTRITION_EVOLUTION", action: "MANAGE", effect: "DENY" },
] as const;

export const BUILT_IN_IDS = {
  users: {
    sauloXavierVitorino: "00000000-0000-4000-8000-000000000001",
    mariaDeLourdesGomes: "00000000-0000-4000-8000-000000000002",
  },
  roles: {
    systemOwner: "00000000-0000-4000-8000-000000000101",
    sharedProfessional: "00000000-0000-4000-8000-000000000102",
  },
} as const;

export const BUILT_IN_ACCESS_POLICIES = {
  sauloXavierVitorino: {
    userId: BUILT_IN_IDS.users.sauloXavierVitorino,
    roleKeys: ["SYSTEM_OWNER"],
    overrides: [],
  },
  mariaDeLourdesGomes: {
    userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
    roleKeys: ["SHARED_PROFESSIONAL"],
    overrides: nutritionDenyOverrides,
  },
} as const satisfies Record<string, UserAccessPolicy>;
