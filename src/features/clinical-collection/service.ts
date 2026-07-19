import type { ClinicalCollectionGateway } from "./gateway";
import { mockClinicalCollectionGateway } from "./mock-gateway";

// Adaptador temporário e explicitamente mockado; substituir quando os endpoints forem aprovados.
export const clinicalCollectionService: ClinicalCollectionGateway = mockClinicalCollectionGateway;
