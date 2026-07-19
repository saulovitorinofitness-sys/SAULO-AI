"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clinicalCollectionService, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { clinicalDecisionService, type ClinicalDecisionScenario, type ClinicalDecisionScenarioKey, type ClinicalDecisionWorkspace } from "@/features/clinical-decision";
import { PageState } from "@/components/ui/page-state";
import { ClinicalDecisionWorkspaceView } from "./clinical-decision-workspace";

type GuardState =
  | { readonly status: "LOADING" }
  | { readonly status: "COLLECTION_BLOCKED" }
  | { readonly status: "PANEL_BLOCKED" }
  | { readonly status: "CONFIRMATION_REQUIRED" }
  | { readonly status: "ERROR" }
  | { readonly status: "READY"; readonly workspace: ClinicalDecisionWorkspace };

export function ClinicalDecisionRouteGuard({ patientId, attendanceId, collectionScenario, decisionScenario, scenarios }: { patientId: string; attendanceId: string; collectionScenario: ClinicalCollectionScenarioKey; decisionScenario?: ClinicalDecisionScenarioKey; scenarios: readonly ClinicalDecisionScenario[] }) {
  const [state, setState] = useState<GuardState>({ status: "LOADING" });
  const collectionHref = `/pacientes/${patientId}/atendimentos/${attendanceId}/coleta?scenario=${collectionScenario}`;
  const panelHref = `/pacientes/${patientId}/atendimentos/${attendanceId}/painel-clinico?scenario=${collectionScenario}`;

  useEffect(() => {
    let active = true;
    async function validateOfficialFlow() {
      try {
        const panel = await clinicalCollectionService.getClinicalPanel({ patientId, attendanceId, scenario: collectionScenario });
        if (!active) return;
        if (!panel?.collection.completed) { setState({ status: "COLLECTION_BLOCKED" }); return; }
        if (!panel.accessible) { setState({ status: "PANEL_BLOCKED" }); return; }
        if (!panel.confirmedAt) { setState({ status: "CONFIRMATION_REQUIRED" }); return; }
        const workspace = await clinicalDecisionService.getWorkspace({ patientId, attendanceId, collectionScenario, decisionScenario });
        if (!active) return;
        setState(workspace ? { status: "READY", workspace } : { status: "ERROR" });
      } catch {
        if (active) setState({ status: "ERROR" });
      }
    }
    void validateOfficialFlow();
    return () => { active = false; };
  }, [attendanceId, collectionScenario, decisionScenario, patientId]);

  const actionClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-5 text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12664f]";
  if (state.status === "LOADING") return <PageState description="Validando coleta, revisão profissional e permissão antes de liberar o Motor." title="Verificando pré-condições" />;
  if (state.status === "COLLECTION_BLOCKED") return <PageState action={<Link className={actionClass} href={collectionHref}>Concluir coleta clínica</Link>} description="O Motor de Decisão exige todas as etapas obrigatórias da coleta concluídas." title="Motor bloqueado" tone="blocked" />;
  if (state.status === "PANEL_BLOCKED") return <PageState action={<Link className={actionClass} href={panelHref}>Revisar pendências no Painel</Link>} description="O Painel Clínico possui pendências de integridade. Revise a coleta antes de confirmar os dados." title="Painel Clínico indisponível" tone="blocked" />;
  if (state.status === "CONFIRMATION_REQUIRED") return <PageState action={<Link className={actionClass} href={panelHref}>Abrir Painel Clínico</Link>} description="A coleta está concluída, mas a revisão profissional do Painel Clínico ainda não foi confirmada." title="Confirmação profissional necessária" tone="blocked" />;
  if (state.status === "ERROR") return <PageState action={<Link className={actionClass} href={panelHref}>Voltar ao Painel Clínico</Link>} description="Não foi possível validar o fluxo oficial no estado mockado." title="Falha ao validar acesso" tone="danger" />;
  return <ClinicalDecisionWorkspaceView initialWorkspace={state.workspace} scenarios={scenarios} />;
}
