"use client";

import { useCallback, useState } from "react";
import { Button, PageHeading, SectionHeader } from "@/components/ui";
import { RevenueChart } from "@/components/executive-dashboard";
import type { ExecutiveIntelligenceView } from "@/features/executive-intelligence";
import { ActionBoard } from "./action-board";
import { AlertPanel } from "./alert-panel";
import { ClinicSummary, CommercialSummary, FinancialSummary, GymSummary, MarketingSummary } from "./business-summaries";
import { ExecutiveSummary } from "./executive-summary";
import { MeetingDrawer } from "./meeting-drawer";
import { ProblemBoard } from "./problem-board";
import { WeeklyGoals } from "./weekly-goals";

const formatDateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function ExecutiveDashboard({ view }: { view: ExecutiveIntelligenceView }) {
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(() => formatDateTime(view.generatedAt));
  const closeMeeting = useCallback(() => setMeetingOpen(false), []);
  const byId = (id: ExecutiveIntelligenceView["areas"][number]["id"]) => view.areas.find((area) => area.id === id)!;
  return <div className="grid gap-6"><PageHeading action={<div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => setRefreshedAt(formatDateTime(new Date().toISOString()))} variant="outline">Atualizar</Button><Button onClick={() => setMeetingOpen(true)}>Iniciar Reunião</Button></div>} description="Visão semanal consolidada da Clínica SV e da Academia Saulo Fitness para apoio à decisão de Saulo." eyebrow="Gestão · dados demonstrativos" title="Central de Inteligência" /><p aria-live="polite" className="-mt-4 text-xs font-bold text-[var(--muted)]">Última atualização visual: {refreshedAt}</p><ExecutiveSummary summary={view.summary} /><section aria-labelledby="business-overview"><SectionHeader description="Indicadores organizados por área, sem previsão ou recomendação automática." title="Visão por área" /><h2 className="sr-only" id="business-overview">Visão empresarial por área</h2><div className="mt-4 grid gap-6 xl:grid-cols-2"><ClinicSummary area={byId("clinic")} /><GymSummary area={byId("academy")} /><FinancialSummary area={byId("financial")} /><MarketingSummary area={byId("marketing")} /><div className="xl:col-span-2"><CommercialSummary area={byId("commercial")} /></div></div></section><div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]"><RevenueChart periods={view.financialPeriods} /><AlertPanel alerts={view.alerts} /></div><div className="grid items-start gap-6 xl:grid-cols-2"><ProblemBoard initialProblems={view.problems} /><ActionBoard initialActions={view.actions} /></div><WeeklyGoals initialGoals={view.goals} /><MeetingDrawer onClose={closeMeeting} open={meetingOpen} view={view} /></div>;
}

