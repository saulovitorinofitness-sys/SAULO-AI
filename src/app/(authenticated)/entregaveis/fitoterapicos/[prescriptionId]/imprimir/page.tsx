import type { Metadata } from "next";

import { HerbalPrescriptionDocument } from "@/components/herbal-prescriptions/herbal-prescription-document";
import { PageState } from "@/components/ui/page-state";
import { herbalPrescriptionService } from "@/features/herbal-prescriptions/service";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Imprimir prescrição de fitoterápicos" };

type SearchValue = string | string[] | undefined;

export default async function PrintHerbalPrescriptionPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ prescriptionId: string }>;
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
  const prescription = await herbalPrescriptionService.get(patientId, route.prescriptionId);
  const preview = query.preview === "1";
  const canRender = prescription && (prescription.status === "PUBLISHED" || (preview && prescription.status === "DRAFT"));
  if (!canRender) {
    return <PageState title="Documento não encontrado" description="Use a impressão para documentos emitidos ou a ação de prévia para rascunhos." tone="blocked" />;
  }
  return <HerbalPrescriptionDocument autoPrint={query.print === "1"} prescription={prescription} preview={preview} />;
}
