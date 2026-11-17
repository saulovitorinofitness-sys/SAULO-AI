import { resolveFinancialAccess } from "@/features/financial/http";
import { createProfessionalReceiptHttpHandlers } from "@/features/financial/service-receipts";

export const professionalReceiptHandlers = createProfessionalReceiptHttpHandlers({
  resolveAccess: resolveFinancialAccess,
});
