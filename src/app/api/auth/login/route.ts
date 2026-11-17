import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE_NAME } from "@/features/mvp";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SCRYPT_PARAMETERS = {
  cost: 32768,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
  saltLength: 16,
} as const;

const loginSchema = z
  .object({
    login: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(254)
      .regex(/^[^\s\u0000-\u001F\u007F]+$/u),
    password: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^\u0000-\u001F\u007F]+$/u),
  })
  .strict();

interface ParsedCredentialHash {
  readonly salt: Buffer;
  readonly derivedKey: Buffer;
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

type AuthenticationOutcome =
  | "INPUT_REJECTED"
  | "IDENTITY_NOT_FOUND"
  | "CREDENTIAL_HASH_INVALID"
  | "PASSWORD_MISMATCH"
  | "USER_INACTIVE"
  | "AUTHENTICATED"
  | "TECHNICAL_ERROR";

function logAuthenticationOutcome(outcome: AuthenticationOutcome) {
  console.info(`[auth.login] outcome=${outcome}`);
}

function parseCredentialHash(
  credentialHash: string | null | undefined,
): ParsedCredentialHash | null {
  if (!credentialHash) return null;

  const [algorithm, version, parameters, encodedSalt, encodedDerivedKey, extra] =
    credentialHash.split("$");

  if (
    extra !== undefined ||
    algorithm !== "scrypt" ||
    version !== "v=1" ||
    parameters !== "N=32768,r=8,p=1" ||
    !/^[A-Za-z0-9_-]{22}$/u.test(encodedSalt ?? "") ||
    !/^[A-Za-z0-9_-]{86}$/u.test(encodedDerivedKey ?? "")
  ) {
    return null;
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const derivedKey = Buffer.from(encodedDerivedKey, "base64url");

  if (
    salt.length !== SCRYPT_PARAMETERS.saltLength ||
    derivedKey.length !== SCRYPT_PARAMETERS.keyLength
  ) {
    return null;
  }

  return { salt, derivedKey };
}

function deriveCredentialKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_PARAMETERS.keyLength,
      {
        N: SCRYPT_PARAMETERS.cost,
        r: SCRYPT_PARAMETERS.blockSize,
        p: SCRYPT_PARAMETERS.parallelization,
        maxmem: SCRYPT_PARAMETERS.maxmem,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

async function verifyPassword(
  password: string,
  credentialHash: string | null | undefined,
) {
  const parsed = parseCredentialHash(credentialHash);
  const salt = parsed?.salt ?? Buffer.alloc(SCRYPT_PARAMETERS.saltLength);
  const expectedKey =
    parsed?.derivedKey ?? Buffer.alloc(SCRYPT_PARAMETERS.keyLength);
  const actualKey = await deriveCredentialKey(password, salt);
  const matches = timingSafeEqual(actualKey, expectedKey);

  return parsed !== null && matches;
}

function sessionTokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ message: "Entrada inválida." }, 400);
  }

  const parsedInput = loginSchema.safeParse(requestBody);

  if (!parsedInput.success) {
    logAuthenticationOutcome("INPUT_REJECTED");
    return jsonResponse({ message: "Entrada inválida." }, 400);
  }

  try {
    const identity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: "CREDENTIALS",
          providerSubject: parsedInput.data.login,
        },
      },
      select: {
        credentialHash: true,
        user: {
          select: {
            id: true,
            fullName: true,
            status: true,
            deletedAt: true,
            profile: {
              select: {
                type: true,
                professionalTitle: true,
              },
            },
            roles: {
              select: {
                role: {
                  select: {
                    name: true,
                    grantsAllModules: true,
                    allowsNutritionModules: true,
                    permissions: {
                      where: { module: { active: true } },
                      select: {
                        action: true,
                        effect: true,
                        module: { select: { key: true } },
                      },
                    },
                  },
                },
              },
            },
            permissionOverrides: {
              where: { module: { active: true } },
              select: {
                action: true,
                effect: true,
                module: { select: { key: true } },
              },
            },
          },
        },
      },
    });

    const credentialHashValid =
      parseCredentialHash(identity?.credentialHash) !== null;
    const validPassword = await verifyPassword(
      parsedInput.data.password,
      identity?.credentialHash,
    );

    if (!identity || !validPassword) {
      logAuthenticationOutcome(
        !identity
          ? "IDENTITY_NOT_FOUND"
          : !credentialHashValid
            ? "CREDENTIAL_HASH_INVALID"
            : "PASSWORD_MISMATCH",
      );
      return jsonResponse({ message: "Credenciais inválidas." }, 401);
    }

    if (identity.user.status !== "ACTIVE" || identity.user.deletedAt) {
      logAuthenticationOutcome("USER_INACTIVE");
      return jsonResponse({ message: "Acesso não permitido." }, 403);
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await prisma.authSession.create({
      data: {
        userId: identity.user.id,
        tokenHash: sessionTokenHash(token),
        expiresAt,
      },
    });

    const effectivePermissions = new Map<
      string,
      { moduleKey: string; action: string; effect: string }
    >();

    for (const assignment of identity.user.roles) {
      for (const permission of assignment.role.permissions) {
        const entry = {
          moduleKey: permission.module.key,
          action: permission.action,
          effect: permission.effect,
        };
        const key = `${entry.moduleKey}:${entry.action}`;
        const current = effectivePermissions.get(key);

        if (!current || entry.effect === "DENY") {
          effectivePermissions.set(key, entry);
        }
      }
    }

    for (const permission of identity.user.permissionOverrides) {
      const entry = {
        moduleKey: permission.module.key,
        action: permission.action,
        effect: permission.effect,
      };
      effectivePermissions.set(`${entry.moduleKey}:${entry.action}`, entry);
    }

    const roles = identity.user.roles.map(({ role }) => role.name);
    const profile =
      roles.join(" · ") ||
      identity.user.profile?.professionalTitle ||
      identity.user.profile?.type ||
      "Usuário";
    const response = jsonResponse(
      {
        user: {
          id: identity.user.id,
          name: identity.user.fullName,
          status: identity.user.status,
        },
        profile,
        roles,
        permissions: {
          grantsAllModules: identity.user.roles.some(
            ({ role }) => role.grantsAllModules,
          ),
          allowsNutritionModules: identity.user.roles.some(
            ({ role }) => role.allowsNutritionModules,
          ),
          entries: [...effectivePermissions.values()],
        },
        homePath:
          identity.user.profile?.type === "STUDENT" ? "/portal" : "/dashboard",
      },
      200,
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });

    logAuthenticationOutcome("AUTHENTICATED");
    return response;
  } catch {
    logAuthenticationOutcome("TECHNICAL_ERROR");
    return jsonResponse({ message: "Erro interno." }, 500);
  }
}
