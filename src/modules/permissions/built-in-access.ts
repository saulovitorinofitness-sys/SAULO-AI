import type { UserAccessPolicy } from "./domain";

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
    overrides: [],
  },
} as const satisfies Record<string, UserAccessPolicy>;
