import type { MvpFrontendGateway } from "./gateway";
import { mockMvpGateway } from "./mock-gateway";

// Trocar somente este adaptador quando os endpoints documentados estiverem disponíveis.
export const mvpService: MvpFrontendGateway = mockMvpGateway;
