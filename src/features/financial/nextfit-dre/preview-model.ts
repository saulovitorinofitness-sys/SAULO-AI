import type { NextFitDreExerciseProgress, NextFitDreLine } from "./contracts";

export const NEXTFIT_DRE_MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

export function buildExerciseProgress(
  year: number,
  lastClosedMonth: number,
): NextFitDreExerciseProgress {
  if (!Number.isInteger(lastClosedMonth) || lastClosedMonth < 1 || lastClosedMonth > 12) {
    throw new Error("A última competência apurada deve estar entre janeiro e dezembro.");
  }
  const all = Array.from({ length: 12 }, (_, index) =>
    `${year}-${String(index + 1).padStart(2, "0")}-01`);
  return {
    exerciseKey: `NEXTFIT_DRE:${year}`,
    lastClosedMonth,
    lastClosedCompetence: all[lastClosedMonth - 1],
    closedCompetences: all.slice(0, lastClosedMonth),
    pendingCompetences: all.slice(lastClosedMonth),
    closedCount: lastClosedMonth,
    pendingCount: 12 - lastClosedMonth,
    percentage: Number(((lastClosedMonth / 12) * 100).toFixed(1)),
    complete: lastClosedMonth === 12,
  };
}

export function lineAmountByMonth(line: NextFitDreLine, month: number) {
  const monthToken = `-${String(month).padStart(2, "0")}-`;
  return line.values.find((value) => value.competence.includes(monthToken));
}
