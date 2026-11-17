import { z } from "zod";

import type { FrontendAccessSnapshot } from "@/features/mvp";
import { CpfOwnershipError } from "@/features/identity/cpf-ownership";
import { BUILT_IN_IDS } from "@/modules/permissions";

import { IssuerConfigurationRepositoryError } from "./issuer-configuration-repository";
import {
  issuerConfigurationService,
  IssuerConfigurationServiceError,
} from "./issuer-configuration-service";

const text = (maximum: number) => z.string().trim().max(maximum);
const address = z.object({
  postalCode: text(10),
  street: text(180),
  number: text(30),
  complement: text(120),
  neighborhood: text(120),
  city: text(120),
  state: text(2),
}).strict();
const registration = z.object({
  number: text(40).optional(),
  category: text(30).optional(),
  state: text(2).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
}).strict();
const payload = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("ACADEMY"), legalName: text(180), tradeName: text(180),
    cnpj: text(18).optional(), address, active: z.boolean(),
  }).strict(),
  z.object({
    section: z.literal("CLINIC"), commercialName: text(180),
    internalCode: z.literal("CLINICA_SV"), active: z.boolean(),
  }).strict(),
  z.object({
    section: z.literal("SAULO"), fullName: text(180), cpf: text(14).optional(),
    address, active: z.boolean(), crn: registration.optional(), cref: registration.optional(),
  }).strict(),
  z.object({
    section: z.literal("MARIA"), fullName: text(180), cpf: text(14).optional(),
    address, active: z.boolean(), cref: registration.optional(),
  }).strict(),
]);

type AccessResolver = (request: Request) => Promise<FrontendAccessSnapshot>;
type ConfigurationService = typeof issuerConfigurationService;

export interface IssuerConfigurationHttpDependencies {
  readonly resolveAccess: AccessResolver;
  readonly service?: ConfigurationService;
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function actor(dependencies: IssuerConfigurationHttpDependencies, request: Request): Promise<string | Response> {
  let access: FrontendAccessSnapshot;
  try {
    access = await dependencies.resolveAccess(request);
  } catch {
    return json({ code: "UNAUTHENTICATED", message: "Entre novamente para continuar." }, 401);
  }
  if (access.user.id !== BUILT_IN_IDS.users.sauloXavierVitorino) {
    return json({ code: "FORBIDDEN", message: "Acesso restrito ao administrador." }, 403);
  }
  return access.user.id;
}

function errorResponse(error: unknown) {
  if (error instanceof CpfOwnershipError) {
    return json({ code: error.code, message: error.message }, 409);
  }
  if (error instanceof IssuerConfigurationServiceError) {
    return json(
      { code: error.code, message: error.message },
      error.code === "NOT_AUTHORIZED" ? 403 : error.code === "ISSUER_INCOMPLETE" ? 422 : 400,
    );
  }
  if (error instanceof IssuerConfigurationRepositoryError) {
    return json({ code: error.code, message: error.message }, error.code === "NOT_FOUND" ? 404 : 409);
  }
  return json({ code: "UNAVAILABLE", message: "Configuracao indisponivel no momento." }, 503);
}

export function createIssuerConfigurationHttpHandlers(dependencies: IssuerConfigurationHttpDependencies) {
  const service = dependencies.service ?? issuerConfigurationService;
  return {
    async get(request: Request) {
      const userId = await actor(dependencies, request);
      if (userId instanceof Response) return userId;
      try {
        return json({ configuration: await service.getConfiguration(userId) });
      } catch (error) {
        return errorResponse(error);
      }
    },

    async put(request: Request) {
      const userId = await actor(dependencies, request);
      if (userId instanceof Response) return userId;
      let requestBody: unknown;
      try { requestBody = await request.json(); } catch { requestBody = null; }
      const parsed = payload.safeParse(requestBody);
      if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Dados da configuracao invalidos." }, 400);
      try {
        return json({ configuration: await service.saveConfiguration(parsed.data, userId) });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
