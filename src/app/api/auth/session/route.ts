import { NextResponse } from "next/server";

import { mvpService } from "@/features/mvp";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { message: "Sessão ausente ou inválida." },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET() {
  try {
    const access = await mvpService.getSession();
    const roles = access.user.roleName
      .split(" · ")
      .map((role) => role.trim())
      .filter(Boolean);

    return NextResponse.json(
      {
        user: {
          id: access.user.id,
          name: access.user.fullName,
        },
        profile: access.user.roleName,
        roles,
        permissions: {
          grantsAllModules: access.grantsAllModules,
          allowsNutritionModules: access.allowsNutritionModules,
          entries: access.overrides.map((permission) => ({
            moduleKey: permission.moduleKey,
            action: permission.action,
            effect: permission.effect,
          })),
        },
        homePath:
          access.user.profileType === "STUDENT" ? "/portal" : "/dashboard",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isSessionAuthenticationError(error)) {
      return unauthorizedResponse();
    }

    console.error("Falha ao consultar a sessão atual.", error);
    return NextResponse.json(
      { message: "Não foi possível consultar a sessão atual." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
