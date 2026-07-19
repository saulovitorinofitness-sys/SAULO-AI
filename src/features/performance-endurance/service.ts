import type { SessionUser } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";
import type { PerformanceEnduranceView } from "./contracts";
import { performanceEnduranceMock } from "./mock-data";

export const performanceEnduranceService = {
  canAccess(user: SessionUser) { return user.id === BUILT_IN_IDS.users.sauloXavierVitorino; },
  async getView(user: SessionUser): Promise<PerformanceEnduranceView | null> { return this.canAccess(user) ? structuredClone(performanceEnduranceMock) : null; },
};

