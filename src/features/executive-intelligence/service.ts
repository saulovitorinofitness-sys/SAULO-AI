import type { SessionUser } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";
import type { ExecutiveIntelligenceView } from "./contracts";
import { executiveIntelligenceMock } from "./mock-data";

export const executiveIntelligenceService = {
  canAccess(user: SessionUser): boolean {
    return user.id === BUILT_IN_IDS.users.sauloXavierVitorino;
  },
  async getView(user: SessionUser): Promise<ExecutiveIntelligenceView | null> {
    if (!this.canAccess(user)) return null;
    return structuredClone(executiveIntelligenceMock);
  },
};

