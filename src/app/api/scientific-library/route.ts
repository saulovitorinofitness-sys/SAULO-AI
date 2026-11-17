import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { mvpService } from "@/features/mvp";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";
import {
  scientificLibraryAreaForItem,
  scientificLibraryService,
} from "@/features/scientific-library";
import {
  normalizeScientificLibraryName,
  scientificLibraryDraftSchema,
  scientificLibraryImportDraftSchema,
} from "@/features/scientific-library/management-contracts";
import { scientificLibraryRepository } from "@/features/scientific-library/repository";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("MANUAL"),
    draft: scientificLibraryDraftSchema,
  }).strict(),
  z.object({
    mode: z.literal("UPDATE"),
    id: z.string().uuid(),
    draft: scientificLibraryDraftSchema,
  }).strict(),
  z.object({
    mode: z.literal("IMPORT"),
    confirm: z.literal(true),
    fileName: z.string().trim().min(1).max(255),
    drafts: z.array(scientificLibraryImportDraftSchema).min(1).max(1000),
  }).strict(),
]);

function unauthorizedResponse() {
  return NextResponse.json(
    { message: "Sessão ausente ou inválida." },
    { status: 401, headers: noStoreHeaders },
  );
}

function internalErrorResponse() {
  return NextResponse.json(
    { message: "Não foi possível processar a Biblioteca Científica." },
    { status: 500, headers: noStoreHeaders },
  );
}

function validationIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function itemKey(input: { area: string; domain: string; name: string }) {
  return `${input.area}|${input.domain}|${normalizeScientificLibraryName(input.name)}`;
}

function isPrescriptionModel(input: { area: string; domain: string; tags?: readonly string[] }) {
  return input.area === "NUTRITION" &&
    (input.domain === "FORMULATION" || input.domain === "SUPPLEMENT") &&
    input.tags?.includes("modelo de prescrição");
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof mvpService.getSession>>;
  try {
    session = await mvpService.getSession();
  } catch (error) {
    if (isSessionAuthenticationError(error)) return unauthorizedResponse();
    console.error("Falha ao consultar a sessão da Biblioteca Científica.", error);
    return internalErrorResponse();
  }

  const access = resolveDevelopmentAccess(request, session);
  if (!scientificLibraryService.canAccess(access.user)) {
    return NextResponse.json(
      { message: "Seu perfil não possui autorização para gerenciar a Biblioteca Científica." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Não foi possível interpretar os dados enviados." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Revise os dados científicos e editoriais informados.",
        issues: validationIssues(parsed.error),
      },
      { status: 400, headers: noStoreHeaders },
    );
  }

  try {
    const currentView = await scientificLibraryService.getView(access.user);
    const persistedItems =
      currentView?.items.filter((item) => item.storageKind === "PERSISTED") ??
      [];
    const currentKeys = new Set(
      persistedItems.flatMap((item) => {
        const area = item.area ?? scientificLibraryAreaForItem(item);
        return area ? [itemKey({ area, domain: item.domain, name: item.name })] : [];
      }),
    );

    if (parsed.data.mode === "UPDATE") {
      const update = parsed.data;
      if (update.draft.area !== "PERFORMANCE" || update.draft.domain !== "EXERCISE") {
        return NextResponse.json(
          { message: "Somente exercícios profissionais podem ser editados por este fluxo." },
          { status: 400, headers: noStoreHeaders },
        );
      }
      const duplicate = persistedItems.some((item) => {
        if (item.id === update.id) return false;
        const area = item.area ?? scientificLibraryAreaForItem(item);
        return area
          ? itemKey({ area, domain: item.domain, name: item.name }) === itemKey(update.draft)
          : false;
      });
      if (duplicate) {
        return NextResponse.json(
          { message: "Já existe um item com este nome na área e domínio selecionados." },
          { status: 409, headers: noStoreHeaders },
        );
      }
      const item = await scientificLibraryRepository.updateExercise({
        professionalUserId: access.user.id,
        id: update.id,
        draft: update.draft,
      });
      if (!item) {
        return NextResponse.json(
          { message: "Exercício profissional não encontrado." },
          { status: 404, headers: noStoreHeaders },
        );
      }
      return NextResponse.json({ item }, { headers: noStoreHeaders });
    }

    if (parsed.data.mode === "MANUAL") {
      const draft = parsed.data.draft;
      const key = itemKey(draft);
      const existingItem = persistedItems.find((item) => {
        const area = item.area ?? scientificLibraryAreaForItem(item);
        if (isPrescriptionModel(draft) && isPrescriptionModel(item)) {
          return normalizeScientificLibraryName(item.name) === normalizeScientificLibraryName(draft.name);
        }
        return area
          ? itemKey({ area, domain: item.domain, name: item.name }) === key
          : false;
      });
      if (existingItem) {
        return NextResponse.json(
          {
            message: "Já existe um item com este nome na área e domínio selecionados.",
            item: existingItem,
          },
          { status: 409, headers: noStoreHeaders },
        );
      }
      const item = await scientificLibraryService.create({
        professionalUserId: access.user.id,
        draft,
        originKind: "MANUAL",
      });
      return NextResponse.json(
        { item },
        { status: 201, headers: noStoreHeaders },
      );
    }

    const currentPrescriptionModelNames = new Set(
      persistedItems.filter(isPrescriptionModel).map((item) => normalizeScientificLibraryName(item.name)),
    );
    const accepted = parsed.data.drafts.filter((draft) => {
      const key = itemKey(draft);
      const modelName = normalizeScientificLibraryName(draft.name);
      if (currentKeys.has(key) || (isPrescriptionModel(draft) && currentPrescriptionModelNames.has(modelName))) return false;
      currentKeys.add(key);
      if (isPrescriptionModel(draft)) currentPrescriptionModelNames.add(modelName);
      return true;
    });
    const duplicatesBeforeConfirmation = parsed.data.drafts.length - accepted.length;
    if (!accepted.length) {
      return NextResponse.json(
        { items: [], created: 0, duplicates: duplicatesBeforeConfirmation },
        { headers: noStoreHeaders },
      );
    }
    const result = await scientificLibraryRepository.createMany({
      professionalUserId: access.user.id,
      drafts: accepted,
      importFileName: parsed.data.fileName,
    });
    return NextResponse.json(
      {
        items: result.created,
        created: result.created.length,
        duplicates: duplicatesBeforeConfirmation + result.duplicates,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "O item já existe na área e domínio selecionados." },
        { status: 409, headers: noStoreHeaders },
      );
    }
    console.error("Falha ao gerenciar a Biblioteca Científica.", error);
    return internalErrorResponse();
  }
}
