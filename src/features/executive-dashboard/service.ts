import type { SessionUser } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";
import type { ExecutiveDashboardView } from "./contracts";
import { executiveDashboardMock } from "./mock-data";

export const executiveDashboardService = {
  canAccess(user: SessionUser): boolean {
    return user.id === BUILT_IN_IDS.users.sauloXavierVitorino;
  },
  async getDashboard(user: SessionUser): Promise<ExecutiveDashboardView | null> {
    if (!this.canAccess(user)) return null;
    return structuredClone(executiveDashboardMock);
  },
};

