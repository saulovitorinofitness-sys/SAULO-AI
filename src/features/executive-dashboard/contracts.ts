export type ExecutiveMetricTone = "neutral" | "success" | "warning" | "info";

export interface ExecutiveKpi {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly context: string;
  readonly tone: ExecutiveMetricTone;
}

export interface ExecutiveAlert {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly level: "information" | "attention" | "priority";
  readonly area: "clinic" | "academy" | "marketing" | "operations";
}

export interface ExecutiveMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly context?: string;
}

export interface FinancialPeriod {
  readonly label: string;
  readonly revenue: number;
  readonly expenses: number;
  readonly profit: number;
}

export interface ExecutiveTask {
  readonly id: string;
  readonly label: string;
  readonly area: string;
  readonly completed: boolean;
}

export interface WeeklyAgendaDay {
  readonly day: string;
  readonly date: string;
  readonly clinicAppointments: number;
  readonly academyActivities: number;
  readonly highlight?: string;
}

export interface ExecutiveDashboardView {
  readonly generatedAt: string;
  readonly weekLabel: string;
  readonly epidemiologicalWeek: string;
  readonly commercialWeek: string;
  readonly greeting: string;
  readonly professionalName: string;
  readonly kpis: readonly ExecutiveKpi[];
  readonly alerts: readonly ExecutiveAlert[];
  readonly clinicMetrics: readonly ExecutiveMetric[];
  readonly gymMetrics: readonly ExecutiveMetric[];
  readonly marketingMetrics: readonly ExecutiveMetric[];
  readonly financialPeriods: readonly FinancialPeriod[];
  readonly tasks: readonly ExecutiveTask[];
  readonly agenda: readonly WeeklyAgendaDay[];
}

