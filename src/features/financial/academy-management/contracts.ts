import type { NextFitDreLine, NextFitDreWarning } from "../nextfit-dre";

export type FinancialManagementUnavailableReason =
  | "SNAPSHOT_NOT_FOUND"
  | "SNAPSHOT_INVALID"
  | "SEMANTIC_LINE_MISSING";

export interface FinancialManagementSource {
  readonly batchId: string;
  readonly sourceSystem: "NEXTFIT";
  readonly fileName: string;
  readonly fileHash: string;
  readonly status: "VALIDATED" | "IMPORTED";
  readonly importedAt: string;
  readonly competence: string;
  readonly snapshotVersion: string;
  readonly parserVersion: string;
}

export interface FinancialManagementExercise {
  readonly year: number;
  readonly competenceCount: number;
  readonly closedCount: number;
  readonly pendingCount: number;
  readonly firstClosedCompetence: string;
  readonly lastClosedCompetence: string;
  readonly closedCompetences: readonly string[];
  readonly pendingCompetences: readonly string[];
  readonly percentage: number;
  readonly complete: boolean;
}

export interface FinancialManagementLineSource {
  readonly rowNumber: number;
  readonly description: string;
  readonly kind: "GROUP" | "RESULT";
  readonly context?: string;
}

export interface FinancialManagementAmount {
  readonly amount: string;
  readonly source: FinancialManagementLineSource;
}

export interface FinancialManagementMargin {
  readonly percentage?: number;
  readonly numerator: FinancialManagementLineSource;
  readonly denominator: FinancialManagementLineSource;
}

export interface FinancialManagementMonthResult {
  readonly competence: string;
  readonly month: number;
  readonly netRevenue: string;
  readonly costs: string;
  readonly expenses: string;
  readonly finalResult: string;
}

export interface FinancialManagementRankedMonth {
  readonly competence: string;
  readonly amount: string;
}

export interface FinancialManagementVariation {
  readonly basis: "NET_REVENUE";
  readonly currentCompetence: string;
  readonly previousCompetence?: string;
  readonly currentAmount: string;
  readonly previousAmount?: string;
  readonly absoluteChange?: string;
  readonly percentageChange?: number;
  readonly direction: "GROWTH" | "RETRACTION" | "STABLE" | "UNAVAILABLE";
}

export interface FinancialManagementIndicators {
  readonly grossRevenue: FinancialManagementAmount;
  readonly deductions: FinancialManagementAmount;
  readonly netRevenue: FinancialManagementAmount;
  readonly costs: FinancialManagementAmount;
  readonly expenses: FinancialManagementAmount;
  readonly operatingResult: FinancialManagementAmount;
  readonly finalResult: FinancialManagementAmount;
  readonly margin: FinancialManagementMargin;
  readonly averageMonthlyNetRevenue: string;
  readonly averageMonthlyExpenses: string;
  readonly averageMonthlyResult: string;
  readonly bestMonth: FinancialManagementRankedMonth;
  readonly worstMonth: FinancialManagementRankedMonth;
  readonly latestVariation: FinancialManagementVariation;
}

export interface FinancialManagementDre {
  readonly groups: readonly string[];
  readonly lines: readonly NextFitDreLine[];
  readonly summaryLines: readonly NextFitDreLine[];
  readonly totalCheck: {
    readonly checked: number;
    readonly matching: number;
    readonly mismatching: number;
  };
  readonly warnings: readonly NextFitDreWarning[];
}

export interface AvailableFinancialManagementView {
  readonly availability: "AVAILABLE";
  readonly source: FinancialManagementSource;
  readonly exercise: FinancialManagementExercise;
  readonly indicators: FinancialManagementIndicators;
  readonly months: readonly FinancialManagementMonthResult[];
  readonly dre: FinancialManagementDre;
}

export interface UnavailableFinancialManagementView {
  readonly availability: "UNAVAILABLE";
  readonly year: number;
  readonly reason: FinancialManagementUnavailableReason;
  readonly message: string;
}

export type FinancialManagementView =
  | AvailableFinancialManagementView
  | UnavailableFinancialManagementView;
