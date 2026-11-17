import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import type { NutritionDeliverableDraft } from "@/features/nutrition-deliverables/contracts";
import { nutritionDeliverablePersistence } from "@/features/nutrition-deliverables/persistence";

const paramsSchema = z.object({
  patientId: z.string().uuid(),
  attendanceId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string; attendanceId: string }> },
) {
  const [rawParams, session] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  const parsed = paramsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Identificação do atendimento inválida." },
      { status: 400 },
    );
  }

  const access = resolveDevelopmentAccess(request, session);
  if (
    !canAccess(access, "MASTER_RECORD", "READ") ||
    !canAccess(access, "MEAL_PLAN", "UPDATE") ||
    !canAccess(access, "DELIVERABLES", "CREATE")
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite criar documentos nutricionais oficiais." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    readonly action?: unknown;
    readonly draft?: unknown;
  } | null;
  if (body?.action !== "SAVE_OFFICIAL_REPORT" || !body.draft) {
    return NextResponse.json(
      { message: "Informe o conteúdo do relatório que será salvo como documento oficial." },
      { status: 400 },
    );
  }

  try {
    const document = await nutritionDeliverablePersistence.saveOfficial({
      ...parsed.data,
      professionalUserId: access.user.id,
      draft: body.draft as NutritionDeliverableDraft,
    });
    return NextResponse.json({ document });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "NUTRITION_DELIVERABLE_CONTEXT_MISMATCH"
    ) {
      return NextResponse.json(
        {
          message:
            "Os identificadores do rascunho não correspondem ao paciente e atendimento desta requisição.",
        },
        { status: 400 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "NUTRITION_DELIVERABLE_ALREADY_OFFICIAL"
    ) {
      return NextResponse.json(
        {
          message:
            "Documentos oficiais são somente leitura. Use Visualizar, Imprimir ou Salvar em PDF na Central de Entregáveis.",
        },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "NUTRITION_DELIVERABLE_INCOMPLETE_DRAFT"
    ) {
      return NextResponse.json(
        {
          message:
            "Estratégia Nutricional e Plano Alimentar concluído são necessários para gerar um documento fiel. O diagnóstico clínico é opcional.",
        },
        { status: 400 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "NUTRITION_DELIVERABLE_SOURCE_NOT_FINALIZED"
    ) {
      return NextResponse.json(
        {
          message:
            "O plano clínico mudou ou deixou de estar finalizado. Reabra a preparação do relatório para conferir a versão oficial atual.",
        },
        { status: 409 },
      );
    }
    console.error("Falha ao persistir o relatório nutricional oficial.", error);
    return NextResponse.json(
      {
        message:
          "Não foi possível salvar o documento oficial. Nenhum documento foi criado; tente novamente.",
      },
      { status: 503 },
    );
  }
}
