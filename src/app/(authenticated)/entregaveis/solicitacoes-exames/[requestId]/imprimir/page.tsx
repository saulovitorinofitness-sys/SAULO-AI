import type { Metadata } from "next";

import { ExamRequestDocument } from "@/components/exam-requests/exam-request-document";
import { PageState } from "@/components/ui/page-state";
import { examRequestService } from "@/features/exam-requests/service";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Imprimir solicitação de exames" };

type SearchValue = string | string[] | undefined;

export default async function PrintExamRequestPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ requestId: string }>;
  readonly searchParams: Promise<{ patientId?: SearchValue; print?: SearchValue; preview?: SearchValue }>;
}) {
  const [access, route, query] = await Promise.all([
    mvpService.getSession(),
    params,
    searchParams,
  ]);
  if (
    !canAccess(access, "MASTER_RECORD", "READ") ||
    !canAccess(access, "DELIVERABLES", "READ")
  ) {
    return <PageState title="Acesso não permitido" description="Seu perfil não possui acesso a este documento." tone="blocked" />;
  }
  const patientId = typeof query.patientId === "string" ? query.patientId : "";
  const request = await examRequestService.get(patientId, route.requestId);
  const preview = query.preview === "1";
  const canRender = request && (request.status === "PUBLISHED" || (preview && request.status === "DRAFT"));
  if (!canRender) {
    return <PageState title="Documento não encontrado" description="Use a impressão para documentos emitidos ou a ação de prévia para rascunhos." tone="blocked" />;
  }
  return <ExamRequestDocument autoPrint={query.print === "1"} preview={preview} request={request} />;
}
