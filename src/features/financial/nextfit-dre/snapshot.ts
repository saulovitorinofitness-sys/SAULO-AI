import type {
  NextFitDreExerciseProgress,
  NextFitDreSnapshot,
} from "./contracts";
import {
  NEXTFIT_DRE_PARSER_VERSION,
  NEXTFIT_DRE_SNAPSHOT_VERSION,
} from "./contracts";
import type { ParsedNextFitDre } from "./parser";

export function buildNextFitDreSnapshot(
  parsed: ParsedNextFitDre,
  exercise: NextFitDreExerciseProgress,
): NextFitDreSnapshot {
  return {
    kind: "NEXTFIT_DRE",
    snapshotVersion: NEXTFIT_DRE_SNAPSHOT_VERSION,
    parserVersion: NEXTFIT_DRE_PARSER_VERSION,
    year: parsed.year,
    competenceCount: parsed.competences.length,
    exercise,
    sheetNames: parsed.sheetNames,
    groups: parsed.groups,
    lines: parsed.lines,
    totalCheck: {
      checked: parsed.lines.filter((line) => line.total).length,
      matching: parsed.lines.filter((line) => line.total?.matches).length,
      mismatching: parsed.lines.filter((line) => line.total && !line.total.matches).length,
    },
    warnings: parsed.warnings,
  };
}
