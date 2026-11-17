import type {
  FrontendAccessSnapshot,
  SessionUser,
} from "@/features/mvp";
import {
  BUILT_IN_ACCESS_POLICIES,
  BUILT_IN_IDS,
  type AccessAction,
} from "@/modules/permissions";
import type { ModuleKey } from "@/modules/shared";

export const DEVELOPMENT_USER_STORAGE_KEY =
  "saulo-ai:development-active-user";
export const DEVELOPMENT_USER_QUERY_KEY = "devUser";
export const DEVELOPMENT_USER_HEADER = "x-development-user-id";

export type DevelopmentUserKey = "saulo" | "maria";

export interface DevelopmentProfessional {
  readonly key: DevelopmentUserKey;
  readonly user: SessionUser;
  readonly functionName: string;
  readonly professionalRegistration?: string;
  readonly whatsapp?: string;
  readonly instagram?: string;
  readonly access: FrontendAccessSnapshot;
}

const sauloUser: SessionUser = {
  id: BUILT_IN_IDS.users.sauloXavierVitorino,
  fullName: "Saulo Xavier Vitorino",
  email: "saulo@saulo-ai.local",
  status: "ACTIVE",
  roleName: "Acesso total",
};

const mariaUser: SessionUser = {
  id: BUILT_IN_IDS.users.mariaDeLourdesGomes,
  fullName: "Maria de Lourdes Gomes",
  email: "maria@saulo-ai.local",
  status: "ACTIVE",
  roleName: "Profissional de Educação Física",
};

export const DEVELOPMENT_PROFESSIONALS = {
  saulo: {
    key: "saulo",
    user: sauloUser,
    functionName: "Responsável técnico e administrador",
    access: {
      user: sauloUser,
      grantsAllModules: true,
      allowsNutritionModules: true,
      overrides:
        BUILT_IN_ACCESS_POLICIES.sauloXavierVitorino.overrides,
    },
  },
  maria: {
    key: "maria",
    user: mariaUser,
    functionName: "Profissional de Educação Física",
    professionalRegistration: "CREF 019480-G",
    whatsapp: "(88) 99606-6757",
    instagram: "@lurdinhapersonal",
    access: {
      user: mariaUser,
      grantsAllModules: true,
      allowsNutritionModules: false,
      overrides:
        BUILT_IN_ACCESS_POLICIES.mariaDeLourdesGomes.overrides,
    },
  },
} as const satisfies Record<
  DevelopmentUserKey,
  DevelopmentProfessional
>;

export const DEVELOPMENT_PROFESSIONAL_OPTIONS =
  Object.values(DEVELOPMENT_PROFESSIONALS);

export function isDevelopmentUserKey(
  value: string | null | undefined,
): value is DevelopmentUserKey {
  return value === "saulo" || value === "maria";
}

export function developmentProfessionalFromUserId(userId: string) {
  return userId === BUILT_IN_IDS.users.mariaDeLourdesGomes
    ? DEVELOPMENT_PROFESSIONALS.maria
    : DEVELOPMENT_PROFESSIONALS.saulo;
}

export function resolveDevelopmentAccess(
  _request: Request,
  fallback: FrontendAccessSnapshot,
) {
  return fallback;
}

export function canDevelopmentUserAccess(
  professional: DevelopmentProfessional,
  moduleKey: ModuleKey,
  action: AccessAction = "READ",
) {
  const override = professional.access.overrides.find(
    (item) =>
      item.moduleKey === moduleKey && item.action === action,
  );

  if (override) return override.effect === "ALLOW";

  const nutritionModule =
    moduleKey === "NUTRITION_STRATEGY" ||
    moduleKey === "MEAL_PLAN" ||
    moduleKey === "NUTRITION_EVOLUTION";

  if (
    nutritionModule &&
    !professional.access.allowsNutritionModules
  ) {
    return false;
  }

  return professional.access.grantsAllModules;
}

export function canDevelopmentUserOperatePostural(
  professional: DevelopmentProfessional,
) {
  return (
    professional.user.id === BUILT_IN_IDS.users.sauloXavierVitorino ||
    professional.user.id === BUILT_IN_IDS.users.mariaDeLourdesGomes
  );
}

const mariaBlockedRouteFragments = [
  "/estrategia-nutricional",
  "/plano-alimentar",
  "/clinica",
  "/gestao",
  "/administracao",
  "/dashboard",
  "/central-de-dados",
  "/centro-operacoes",
] as const;

export function canDevelopmentUserOpenPath(
  professional: DevelopmentProfessional,
  pathname: string,
) {
  if (professional.key === "saulo") return true;

  return !mariaBlockedRouteFragments.some(
    (fragment) =>
      pathname === fragment ||
      pathname.startsWith(`${fragment}/`) ||
      pathname.includes(fragment),
  );
}
