import type { ExecutiveMetric, FinancialPeriod } from "@/features/executive-dashboard";

export type IntelligenceStatus = "on_track" | "attention" | "priority";
export type WorkStatus = "pending" | "in_progress" | "completed";
export type WorkPriority = "low" | "medium" | "high";

export interface ExecutiveIntelligenceSummary {
  readonly week: string;
  readonly period: string;
  readonly revenue: string;
  readonly expenses: string;
  readonly profit: string;
  readonly goal: string;
  readonly goalPercent: number;
  readonly status: IntelligenceStatus;
}

export interface BusinessAreaSummary {
  readonly id: "clinic" | "academy" | "financial" | "marketing" | "commercial";
  readonly title: string;
  readonly description: string;
  readonly comparison: string;
  readonly status: IntelligenceStatus;
  readonly metrics: readonly ExecutiveMetric[];
}

export interface IntelligenceAlert {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly area: string;
  readonly level: "information" | "attention" | "priority";
}

export interface WeeklyProblem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly area: string;
  readonly responsible: string;
  readonly priority: WorkPriority;
  readonly status: WorkStatus;
}

export interface ExecutiveAction {
  readonly id: string;
  readonly description: string;
  readonly responsible: string;
  readonly dueDate: string;
  readonly status: WorkStatus;
}

export interface WeeklyGoal {
  readonly id: string;
  readonly description: string;
  readonly area: string;
  readonly target: string;
  readonly status: WorkStatus;
}

export interface ExecutiveIntelligenceView {
  readonly generatedAt: string;
  readonly professionalName: string;
  readonly summary: ExecutiveIntelligenceSummary;
  readonly areas: readonly BusinessAreaSummary[];
  readonly financialPeriods: readonly FinancialPeriod[];
  readonly alerts: readonly IntelligenceAlert[];
  readonly problems: readonly WeeklyProblem[];
  readonly actions: readonly ExecutiveAction[];
  readonly goals: readonly WeeklyGoal[];
}

export type ExecutiveMeetingStep = "summary" | "indicators" | "problems" | "actions" | "goals" | "next_week" | "minutes";

