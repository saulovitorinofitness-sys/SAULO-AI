import type { FinancialManagementView } from "../academy-management";
import type {
  FinancialEntryView,
  FinancialSummary,
} from "../contracts";
import type {
  buildAccountsPayableAgenda,
  buildAccountsReceivableAgenda,
} from "../agenda";

export type FinancialExecutiveReportUnit =
  | "ALL"
  | "ACADEMIA"
  | "CLINICA"
  | "PERSONAL";

export type FinancialExecutiveReportPreset =
  | "CURRENT_MONTH"
  | "PREVIOUS_MONTH"
  | "CUSTOM";

export interface FinancialExecutiveReportPeriod {
  readonly start: string;
  readonly end: string;
  readonly label: string;
  readonly preset: FinancialExecutiveReportPreset;
}

export interface FinancialExecutiveEvolutionMonth {
  readonly competence: string;
  readonly totalReceived: string;
  readonly totalPaid: string;
  readonly realizedBalance: string;
}

export interface FinancialExecutiveReportView {
  readonly unit: {
    readonly code: FinancialExecutiveReportUnit;
    readonly name: string;
    readonly businessUnitId?: string;
  };
  readonly period: FinancialExecutiveReportPeriod;
  readonly issuedAt: string;
  readonly summary: FinancialSummary;
  readonly previousPeriod: {
    readonly realizedBalance: string;
    readonly absoluteChange: string;
    readonly percentageChange?: number;
  };
  readonly payables: ReturnType<typeof buildAccountsPayableAgenda>;
  readonly receivables: ReturnType<typeof buildAccountsReceivableAgenda>;
  readonly priorityPayables: readonly FinancialEntryView[];
  readonly priorityReceivables: readonly FinancialEntryView[];
  readonly evolution: readonly FinancialExecutiveEvolutionMonth[];
  readonly dre?: FinancialManagementView;
  readonly reading: readonly string[];
  readonly hasData: boolean;
  readonly presentation: {
    readonly pptxAvailable: true;
    readonly preparedForFutureExport: false;
  };
}
