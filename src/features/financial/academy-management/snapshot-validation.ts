import { z } from "zod";

import {
  NEXTFIT_DRE_PARSER_VERSION,
  NEXTFIT_DRE_SNAPSHOT_VERSION,
  type NextFitDreSnapshot,
} from "../nextfit-dre";

const isoCompetence = z.string().regex(/^\d{4}-\d{2}-01$/);
const money = z.string().regex(/^-?\d+\.\d{2}$/);

const warningSchema = z.object({
  code: z.enum([
    "EMPTY_CELL",
    "MISSING_VALUE",
    "UNEXPECTED_STRUCTURE",
    "MULTIPLE_COMPETENCES",
    "TOTAL_MISMATCH",
    "DUPLICATE_FILE",
    "SNAPSHOT_MISSING",
    "SNAPSHOT_CONFLICT",
  ]),
  message: z.string(),
  severity: z.enum(["INFO", "WARNING", "ERROR"]),
  sheetName: z.string().optional(),
  rowNumber: z.number().int().positive().optional(),
});

const valueSchema = z.object({
  competence: isoCompetence,
  amount: money,
  originalValue: z.string(),
});

const totalSchema = z.object({
  amount: money,
  originalValue: z.string(),
  monthlySum: money,
  difference: money,
  matches: z.boolean(),
});

const lineSchema = z.object({
  sheetName: z.string().min(1),
  rowNumber: z.number().int().positive(),
  description: z.string().min(1),
  values: z.array(valueSchema).length(12),
  isGroup: z.boolean(),
  kind: z.enum(["GROUP", "DETAIL", "RESULT"]),
  context: z.string().optional(),
  total: totalSchema.optional(),
});

const exerciseSchema = z.object({
  exerciseKey: z.string(),
  lastClosedMonth: z.number().int().min(1).max(12),
  lastClosedCompetence: isoCompetence,
  closedCompetences: z.array(isoCompetence),
  pendingCompetences: z.array(isoCompetence),
  closedCount: z.number().int().min(1).max(12),
  pendingCount: z.number().int().min(0).max(11),
  percentage: z.number().min(0).max(100),
  complete: z.boolean(),
});

const snapshotSchema = z.object({
  kind: z.literal("NEXTFIT_DRE"),
  snapshotVersion: z.literal(NEXTFIT_DRE_SNAPSHOT_VERSION),
  parserVersion: z.literal(NEXTFIT_DRE_PARSER_VERSION),
  year: z.number().int().min(2000).max(2100),
  competenceCount: z.literal(12),
  exercise: exerciseSchema,
  sheetNames: z.array(z.string().min(1)).min(1),
  groups: z.array(z.string().min(1)),
  lines: z.array(lineSchema).min(1),
  totalCheck: z.object({
    checked: z.number().int().nonnegative(),
    matching: z.number().int().nonnegative(),
    mismatching: z.number().int().nonnegative(),
  }),
  warnings: z.array(warningSchema),
}).superRefine((snapshot, context) => {
  const expectedCompetences = Array.from(
    { length: 12 },
    (_, index) => `${snapshot.year}-${String(index + 1).padStart(2, "0")}-01`,
  );
  const expectedClosed = expectedCompetences.slice(0, snapshot.exercise.lastClosedMonth);
  const expectedPending = expectedCompetences.slice(snapshot.exercise.lastClosedMonth);
  const expectedPercentage = Number(
    ((snapshot.exercise.lastClosedMonth / 12) * 100).toFixed(1),
  );

  if (snapshot.exercise.exerciseKey !== `NEXTFIT_DRE:${snapshot.year}`) {
    context.addIssue({ code: "custom", path: ["exercise", "exerciseKey"], message: "Exercício divergente." });
  }
  if (snapshot.exercise.lastClosedCompetence !== expectedClosed.at(-1)) {
    context.addIssue({ code: "custom", path: ["exercise", "lastClosedCompetence"], message: "Última competência divergente." });
  }
  if (JSON.stringify(snapshot.exercise.closedCompetences) !== JSON.stringify(expectedClosed)) {
    context.addIssue({ code: "custom", path: ["exercise", "closedCompetences"], message: "Competências apuradas inválidas." });
  }
  if (JSON.stringify(snapshot.exercise.pendingCompetences) !== JSON.stringify(expectedPending)) {
    context.addIssue({ code: "custom", path: ["exercise", "pendingCompetences"], message: "Competências pendentes inválidas." });
  }
  if (
    snapshot.exercise.closedCount !== expectedClosed.length
    || snapshot.exercise.pendingCount !== expectedPending.length
    || snapshot.exercise.percentage !== expectedPercentage
    || snapshot.exercise.complete !== (snapshot.exercise.lastClosedMonth === 12)
  ) {
    context.addIssue({ code: "custom", path: ["exercise"], message: "Progresso do exercício inconsistente." });
  }

  const rowKeys = new Set<string>();
  for (const [lineIndex, line] of snapshot.lines.entries()) {
    const key = `${line.sheetName}:${line.rowNumber}`;
    if (rowKeys.has(key)) {
      context.addIssue({ code: "custom", path: ["lines", lineIndex, "rowNumber"], message: "Posição de linha duplicada." });
    }
    rowKeys.add(key);
    if (JSON.stringify(line.values.map((value) => value.competence)) !== JSON.stringify(expectedCompetences)) {
      context.addIssue({ code: "custom", path: ["lines", lineIndex, "values"], message: "A linha não contém Janeiro a Dezembro na ordem esperada." });
    }
    if (line.isGroup !== (line.kind === "GROUP")) {
      context.addIssue({ code: "custom", path: ["lines", lineIndex, "isGroup"], message: "Classificação de grupo inconsistente." });
    }
  }

  const totalLines = snapshot.lines.filter((line) => line.total);
  const matching = totalLines.filter((line) => line.total?.matches).length;
  if (
    snapshot.totalCheck.checked !== totalLines.length
    || snapshot.totalCheck.matching !== matching
    || snapshot.totalCheck.mismatching !== totalLines.length - matching
  ) {
    context.addIssue({ code: "custom", path: ["totalCheck"], message: "Conferência da coluna Total inconsistente." });
  }
});

export interface ValidSnapshotResult {
  readonly valid: true;
  readonly snapshot: NextFitDreSnapshot;
}

export interface InvalidSnapshotResult {
  readonly valid: false;
  readonly issues: readonly string[];
}

export function validatePersistedNextFitDreSnapshot(
  value: unknown,
): ValidSnapshotResult | InvalidSnapshotResult {
  const result = snapshotSchema.safeParse(value);
  if (!result.success) {
    return {
      valid: false,
      issues: result.error.issues.map((issue) =>
        `${issue.path.join(".") || "snapshot"}: ${issue.message}`),
    };
  }
  return { valid: true, snapshot: result.data };
}
