import { resolveFinancialAccess } from "@/features/financial/http";
import { createIssuerConfigurationHttpHandlers } from "@/features/financial/service-receipts/issuer-configuration-http";

export const runtime = "nodejs";

const handlers = createIssuerConfigurationHttpHandlers({ resolveAccess: resolveFinancialAccess });

export const GET = handlers.get;
export const PUT = handlers.put;
