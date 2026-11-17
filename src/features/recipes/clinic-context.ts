import "server-only";

import { canAccess, mvpService } from "@/features/mvp";
import { prisma } from "@/lib/database/prisma";

import type { ProductLabelContext } from "./product-label-service";
import type { RecipeContext } from "./service";

export const CLINIC_BUSINESS_UNIT_CODE = "CLINICA" as const;

export type ClinicContextAction = "READ" | "CREATE" | "UPDATE" | "DELETE";

export type ClinicContextErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "MODULE_ACCESS_FORBIDDEN"
  | "CLINIC_NOT_CONFIGURED"
  | "CLINIC_INACTIVE"
  | "CLINIC_ACCESS_FORBIDDEN";

export class ClinicContextError extends Error {
  constructor(
    readonly code: ClinicContextErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClinicContextError";
  }
}

export type ClinicRecipesContext = RecipeContext & ProductLabelContext;

function currentDate() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function activeClinicEmploymentFor(userId: string, today: Date) {
  return {
    employments: {
      some: {
        status: "ACTIVE" as const,
        startedAt: { lte: today },
        OR: [{ endedAt: null }, { endedAt: { gte: today } }],
        employee: {
          userId,
          status: "ACTIVE" as const,
          deletedAt: null,
        },
      },
    },
  };
}

export async function resolveClinicRecipesContext(
  action: ClinicContextAction,
): Promise<ClinicRecipesContext> {
  let session: Awaited<ReturnType<typeof mvpService.getSession>>;

  try {
    session = await mvpService.getSession();
  } catch {
    throw new ClinicContextError(
      "AUTHENTICATION_REQUIRED",
      "Sessão autenticada obrigatória.",
    );
  }

  if (!canAccess(session, "MEAL_PLAN", action)) {
    throw new ClinicContextError(
      "MODULE_ACCESS_FORBIDDEN",
      "A sessão não possui permissão para esta operação em Receitas e Produtos.",
    );
  }

  const clinic = await prisma.businessUnit.findUnique({
    where: { code: CLINIC_BUSINESS_UNIT_CODE },
    select: { id: true, status: true },
  });

  if (!clinic) {
    throw new ClinicContextError(
      "CLINIC_NOT_CONFIGURED",
      `A unidade empresarial ${CLINIC_BUSINESS_UNIT_CODE} não está configurada.`,
    );
  }

  if (clinic.status !== "ACTIVE") {
    throw new ClinicContextError(
      "CLINIC_INACTIVE",
      "A unidade empresarial Clínica SV está inativa.",
    );
  }

  if (!session.grantsAllModules) {
    const authorizedClinic = await prisma.businessUnit.findFirst({
      where: {
        id: clinic.id,
        code: CLINIC_BUSINESS_UNIT_CODE,
        status: "ACTIVE",
        ...activeClinicEmploymentFor(session.user.id, currentDate()),
      },
      select: { id: true },
    });

    if (!authorizedClinic) {
      throw new ClinicContextError(
        "CLINIC_ACCESS_FORBIDDEN",
        "O usuário autenticado não possui vínculo ativo e vigente com a Clínica SV.",
      );
    }
  }

  return { businessUnitId: clinic.id };
}
