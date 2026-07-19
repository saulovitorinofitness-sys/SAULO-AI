"use client";

import { useCallback, useState } from "react";
import { SectionHeader } from "@/components/ui";
import type { ExecutiveDashboardView } from "@/features/executive-dashboard";
import { AlertPanel } from "./alert-panel";
import { DashboardHeader } from "./dashboard-header";
import { KpiCard } from "./kpi-card";
import { ClinicMetrics, GymMetrics, MarketingMetrics } from "./metric-panels";
import { MeetingDrawer } from "./meeting-drawer";
import { RevenueChart } from "./revenue-chart";
import { TaskPanel } from "./task-panel";
import { WeeklyAgenda } from "./weekly-agenda";

const formatTime = (date: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);

export function DashboardWorkspace({ dashboard }: { dashboard: ExecutiveDashboardView }) {
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(() => formatTime(new Date(dashboard.generatedAt)));
  const closeMeeting = useCallback(() => setMeetingOpen(false), []);
  return <div className="grid gap-6"><DashboardHeader dashboard={dashboard} onOpenMeeting={() => setMeetingOpen(true)} onRefresh={() => setRefreshedAt(formatTime(new Date()))} refreshedAt={refreshedAt} /><section aria-labelledby="main-kpis"><SectionHeader description="Consolidado operacional mockado da clínica e da academia." title="Visão geral" /><h2 className="sr-only" id="main-kpis">Indicadores principais</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">{dashboard.kpis.map((metric) => <KpiCard key={metric.id} metric={metric} />)}</div></section><div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,.6fr)]"><RevenueChart periods={dashboard.financialPeriods} /><AlertPanel alerts={dashboard.alerts} /></div><div className="grid gap-6 xl:grid-cols-2"><ClinicMetrics metrics={dashboard.clinicMetrics} /><GymMetrics metrics={dashboard.gymMetrics} /></div><div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]"><MarketingMetrics metrics={dashboard.marketingMetrics} /><TaskPanel initialTasks={dashboard.tasks} /></div><WeeklyAgenda days={dashboard.agenda} /><MeetingDrawer onClose={closeMeeting} open={meetingOpen} /></div>;
}
