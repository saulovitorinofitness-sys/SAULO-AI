export type NextFitDreSeverity = "INFO" | "WARNING" | "ERROR";

export interface NextFitDreWarning {
  readonly code:
    | "EMPTY_CELL"
    | "MISSING_VALUE"
    | "UNEXPECTED_STRUCTURE"
    | "MULTIPLE_COMPETENCES"
    | "TOTAL_MISMATCH"
    | "DUPLICATE_FILE"
    | "SNAPSHOT_MISSING"
    | "SNAPSHOT_CONFLICT";
  readonly message: string;
  readonly severity: NextFitDreSeverity;
  readonly sheetName?: string;
  readonly rowNumber?: number;
}

export interface NextFitDreValue {
  readonly competence: string;
  readonly amount: string;
  readonly originalValue: string;
}

export interface NextFitDreTotalCheck {
  readonly amount: string;
  readonly originalValue: string;
  readonly monthlySum: string;
  readonly difference: string;
  readonly matches: boolean;
}

export interface NextFitDreLine {
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly description: string;
  readonly values: readonly NextFitDreValue[];
  readonly isGroup: boolean;
  readonly kind: "GROUP" | "DETAIL" | "RESULT";
  readonly context?: string;
  readonly total?: NextFitDreTotalCheck;
}

export interface NextFitDreExerciseProgress {
  readonly exerciseKey: string;
  readonly lastClosedMonth: number;
  readonly lastClosedCompetence: string;
  readonly closedCompetences: readonly string[];
  readonly pendingCompetences: readonly string[];
  readonly closedCount: number;
  readonly pendingCount: number;
  readonly percentage: number;
  readonly complete: boolean;
}

export interface NextFitDreKeyFigure {
  readonly description: string;
  readonly values: readonly NextFitDreValue[];
}

export interface NextFitDreDuplicateBatch {
  readonly id: string;
  readonly fileName: string;
  readonly competence: string;
  readonly importedAt: string;
  readonly status: "PENDING" | "VALIDATED" | "IMPORTED" | "FAILED" | "CANCELLED";
  readonly hasSnapshot: boolean;
}

export const NEXTFIT_DRE_SNAPSHOT_VERSION = "nextfit-dre-snapshot@1" as const;
export const NEXTFIT_DRE_PARSER_VERSION = "nextfit-dre-horizontal@1" as const;

export interface NextFitDreSnapshot {
  readonly kind: "NEXTFIT_DRE";
  readonly snapshotVersion: typeof NEXTFIT_DRE_SNAPSHOT_VERSION;
  readonly parserVersion: typeof NEXTFIT_DRE_PARSER_VERSION;
  readonly year: number;
  readonly competenceCount: number;
  readonly exercise: NextFitDreExerciseProgress;
  readonly sheetNames: readonly string[];
  readonly groups: readonly string[];
  readonly lines: readonly NextFitDreLine[];
  readonly totalCheck: {
    readonly checked: number;
    readonly matching: number;
    readonly mismatching: number;
  };
  readonly warnings: readonly NextFitDreWarning[];
}

export interface NextFitDrePreview {
  readonly fileName: string;
  readonly fileHash: string;
  readonly year: number;
  readonly sheetNames: readonly string[];
  readonly competences: readonly string[];
  readonly competenceCount: number;
  readonly exercise: NextFitDreExerciseProgress;
  readonly groups: readonly string[];
  readonly keyFigures: readonly NextFitDreKeyFigure[];
  readonly lines: readonly NextFitDreLine[];
  readonly lineCount: number;
  readonly totalCheckCount: number;
  readonly totalMatchCount: number;
  readonly totalMismatchCount: number;
  readonly warnings: readonly NextFitDreWarning[];
  readonly duplicateBatch?: NextFitDreDuplicateBatch;
  readonly canConfirm: boolean;
}

export interface ConfirmedNextFitDreBatch {
  readonly id: string;
  readonly fileName: string;
  readonly fileHash: string;
  readonly competence: string;
  readonly status: "VALIDATED";
  readonly importedAt: string;
  readonly operation: "CREATED" | "SNAPSHOT_ATTACHED";
}

export class NextFitDreError extends Error {
  constructor(
    readonly code:
      | "INVALID_FILE_FORMAT"
      | "FILE_TOO_LARGE"
      | "INVALID_WORKBOOK"
      | "UNEXPECTED_STRUCTURE"
      | "YEAR_REQUIRED"
      | "COMPETENCE_REQUIRED"
      | "DUPLICATE_FILE"
      | "SNAPSHOT_ALREADY_EXISTS"
      | "SNAPSHOT_CONFLICT"
      | "FILE_CHANGED",
    message: string,
  ) {
    super(message);
    this.name = "NextFitDreError";
  }
}
