import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/database/prisma";
import type { PermissionGrant } from "@/modules/permissions";
import type { ModuleKey } from "@/modules/shared";

import type { FrontendAccessSnapshot } from "./contracts";
import type { MvpFrontendGateway } from "./gateway";
import { mockMvpGateway } from "./mock-gateway";
import { requireActiveSession, requireSessionToken, SESSION_COOKIE_NAME } from "./session-authentication";

export { SESSION_COOKIE_NAME } from "./session-authentication";

function sessionTokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function permissionKey(permission: PermissionGrant) {
  return `${permission.moduleKey}:${permission.action}`;
}

async function realSession(): Promise<FrontendAccessSnapshot> {
  const cookieStore = await cookies();
  const token = requireSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  const session = await prisma.authSession.findFirst({
    where: {
      tokenHash: sessionTokenHash(token),
    },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
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

  const activeSession = requireActiveSession(session);

  const rolePermissions = new Map<string, PermissionGrant>();
  for (const assignment of activeSession.user.roles) {
    for (const permission of assignment.role.permissions) {
      const grant: PermissionGrant = {
        moduleKey: permission.module.key as ModuleKey,
        action: permission.action,
        effect: permission.effect,
      };
      const key = permissionKey(grant);
      const current = rolePermissions.get(key);

      if (!current || grant.effect === "DENY") {
        rolePermissions.set(key, grant);
      }
    }
  }

  const effectivePermissions = new Map(rolePermissions);
  for (const permission of activeSession.user.permissionOverrides) {
    const grant: PermissionGrant = {
      moduleKey: permission.module.key as ModuleKey,
      action: permission.action,
      effect: permission.effect,
    };
    effectivePermissions.set(permissionKey(grant), grant);
  }

  const roleNames = activeSession.user.roles.map(({ role }) => role.name);

  return {
    user: {
      id: activeSession.user.id,
      fullName: activeSession.user.fullName,
      email: activeSession.user.email ?? undefined,
      status: activeSession.user.status,
      roleName:
        roleNames.join(" · ") ||
        activeSession.user.profile?.professionalTitle ||
        activeSession.user.profile?.type ||
        "Usuário",
      profileType: activeSession.user.profile?.type,
    },
    grantsAllModules: activeSession.user.roles.some(
      ({ role }) => role.grantsAllModules,
    ),
    allowsNutritionModules: activeSession.user.roles.some(
      ({ role }) => role.allowsNutritionModules,
    ),
    overrides: [...effectivePermissions.values()],
  };
}

const mvpModuleGateway: Omit<MvpFrontendGateway, "getSession"> = {
  searchPatients: (input) => mockMvpGateway.searchPatients(input),
  getPatientMasterRecord: (patientId) =>
    mockMvpGateway.getPatientMasterRecord(patientId),
  getAttendanceContinuity: (patientId) =>
    mockMvpGateway.getAttendanceContinuity(patientId),
  saveAttendanceActivity: (input) =>
    mockMvpGateway.saveAttendanceActivity(input),
};

export const mvpService: MvpFrontendGateway = {
  ...mvpModuleGateway,

  async getSession() {
    return realSession();
  },
};
