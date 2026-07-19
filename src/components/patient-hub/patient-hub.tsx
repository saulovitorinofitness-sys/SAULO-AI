"use client";

import { useEffect, useState } from "react";
import { patientHubService, type PatientHubView } from "@/features/patient-hub";
import { PatientAlertsAndPending } from "./patient-alerts-and-pending";
import { PatientCurrentStatus } from "./patient-current-status";
import { PatientModuleGrid } from "./patient-module-grid";
import { PatientNextAction } from "./patient-next-action";
import { PatientQuickActions } from "./patient-quick-actions";
import { PatientRecordSummary } from "./patient-record-summary";
import { PatientTimeline } from "./patient-timeline";

export function PatientHub({ initialHub }: { initialHub: PatientHubView }) {
  const [hub, setHub] = useState(initialHub);
  useEffect(() => { let active = true; void patientHubService.get({ patientId: initialHub.header.patientId, scenario: initialHub.scenario }).then((updated) => { if (active && updated) setHub(updated); }); return () => { active = false; }; }, [initialHub]);
  return <div className="space-y-5"><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]"><div className="xl:order-2"><PatientNextAction action={hub.nextAction} /></div><div className="xl:order-1"><PatientCurrentStatus hub={hub} /></div></div><PatientModuleGrid modules={hub.modules} /><PatientAlertsAndPending alerts={hub.alerts} pendingItems={hub.pendingItems} /><PatientRecordSummary metrics={hub.recordSummary} /><PatientTimeline events={hub.timeline} /><PatientQuickActions actions={hub.quickActions} /></div>;
}
