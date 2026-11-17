import { NextResponse } from "next/server";
import { z } from "zod";

import { studentPortalService } from "@/features/student-portal/service";

const activationSchema = z.object({
  token: z.string().min(40).max(100),
  login: z.string().min(3).max(254),
  password: z.string().min(8).max(128),
}).strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ message: "Entrada inválida." }, 400);
  }
  const parsed = activationSchema.safeParse(body);
  if (!parsed.success) {
    return response({ message: "Revise o usuário e a senha escolhidos." }, 400);
  }

  try {
    await studentPortalService.activateInvitation(parsed.data);
    return response({ message: "Acesso criado. Entre com seu usuário e senha." }, 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "STUDENT_INVITATION_INVALID") {
        return response({ message: "Convite inválido, expirado ou já utilizado." }, 410);
      }
      if (error.message === "STUDENT_LOGIN_INVALID") {
        return response({ message: "Escolha um usuário válido." }, 400);
      }
      if (error.message === "STUDENT_PASSWORD_WEAK") {
        return response({
          message: "A senha deve ter letras maiúsculas e minúsculas, número e símbolo.",
        }, 400);
      }
      if (error.message.includes("Unique constraint")) {
        return response({ message: "Este usuário já está em uso." }, 409);
      }
    }
    return response({ message: "Não foi possível ativar o acesso." }, 500);
  }
}
