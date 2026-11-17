import { NextResponse } from "next/server";

import {
  resolveDevelopmentAccess,
} from "@/features/development-session";
import { mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";

import { FinancialError } from "./contracts";

export async function resolveFinancialAccess(request: Request) {
  return resolveDevelopmentAccess(
    request,
    await mvpService.getSession(),
  );
}

export async function canUseFinancial(request: Request) {
  const access = await resolveFinancialAccess(request);
  return access.user.id === BUILT_IN_IDS.users.sauloXavierVitorino;
}

export function financialAccessDenied() {
  return NextResponse.json(
    { message: "Seu perfil não permite operar o Financeiro." },
    { status: 403 },
  );
}

export function financialAuthenticationResponse(error: unknown) {
  if (!isSessionAuthenticationError(error)) return null;
  return NextResponse.json(
    { code: "UNAUTHENTICATED", message: "Sessão ausente, expirada ou inválida." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function financialErrorResponse(error: FinancialError) {
  const notFound = [
    "ENTRY_NOT_FOUND",
    "BUSINESS_UNIT_NOT_FOUND",
    "CATEGORY_NOT_FOUND",
    "COST_CENTER_NOT_FOUND",
    "ACCOUNT_NOT_FOUND",
    "PAYMENT_METHOD_NOT_FOUND",
    "REFERENCE_NOT_FOUND",
  ].includes(error.code);
  const conflict = [
    "ENTRY_CANCELLED",
    "ENTRY_ALREADY_SETTLED",
    "ENTRY_HAS_SETTLEMENTS",
    "SETTLEMENT_EXCEEDS_BALANCE",
    "IDEMPOTENCY_CONFLICT",
    "DUPLICATE_REFERENCE_CODE",
    "ACADEMY_REVENUE_REQUIRES_NEXTFIT",
    "ACADEMY_EXPENSE_REQUIRES_MANUAL_SOURCE",
    "NEXTFIT_IMPORT_METADATA_REQUIRED",
    "CLINIC_REALIZED_SOURCE_MISMATCH",
    "PLANNED_SETTLEMENT_NOT_ALLOWED",
    "ACADEMY_SETTLEMENT_NOT_ALLOWED",
  ].includes(error.code);

  return NextResponse.json(
    { code: error.code, message: error.message },
    { status: notFound ? 404 : conflict ? 409 : 400 },
  );
}
