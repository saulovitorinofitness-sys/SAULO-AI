import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/features/mvp";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

function sessionTokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function logoutResponse(message: string, status: number) {
  const response = NextResponse.json(
    { message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value.trim();

    if (token) {
      await prisma.authSession.updateMany({
        where: {
          tokenHash: sessionTokenHash(token),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    return logoutResponse("Sessão encerrada com segurança.", 200);
  } catch {
    return logoutResponse("Não foi possível encerrar a sessão agora.", 500);
  }
}
