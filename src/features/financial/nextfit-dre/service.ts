import { createHash } from "node:crypto";

import type {
  ConfirmedNextFitDreBatch,
  NextFitDrePreview,
  NextFitDreWarning,
} from "./contracts";
import { NextFitDreError } from "./contracts";
import { readNextFitDreWorkbook } from "./parser";
import { buildExerciseProgress } from "./preview-model";
import { buildNextFitDreSnapshot } from "./snapshot";
import {
  nextFitDreBatchRepository,
  type NextFitDreBatchRepository,
} from "./repository";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["xls", "xlsx"]);

function validateFile(fileName: string, bytes: Uint8Array) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.has(extension)) {
    throw new NextFitDreError(
      "INVALID_FILE_FORMAT",
      "Selecione uma planilha DRE NextFit nos formatos XLS ou XLSX.",
    );
  }
  if (!bytes.byteLength) {
    throw new NextFitDreError("INVALID_WORKBOOK", "O arquivo selecionado está vazio.");
  }
  if (bytes.byteLength > MAX_FILE_SIZE) {
    throw new NextFitDreError(
      "FILE_TOO_LARGE",
      "O arquivo excede o limite de 10 MB.",
    );
  }
}

function hashFile(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createNextFitDreService(
  repository: NextFitDreBatchRepository = nextFitDreBatchRepository,
) {
  async function inspect(
    fileName: string,
    bytes: Uint8Array,
    baseYear?: number,
    lastClosedMonth?: number,
  ): Promise<NextFitDrePreview> {
    validateFile(fileName, bytes);
    if (baseYear !== undefined && (!Number.isInteger(baseYear) || baseYear < 2000 || baseYear > 2100)) {
      throw new NextFitDreError("YEAR_REQUIRED", "Informe um ano válido entre 2000 e 2100.");
    }
    const fileHash = hashFile(bytes);
    const [parsed, duplicateBatch] = await Promise.all([
      readNextFitDreWorkbook(bytes, { baseYear }),
      repository.findByHash(fileHash),
    ]);
    if (lastClosedMonth === undefined) {
      throw new NextFitDreError(
        "COMPETENCE_REQUIRED",
        "Informe a última competência apurada para gerar a prévia.",
      );
    }
    let exercise;
    try {
      exercise = buildExerciseProgress(parsed.year, lastClosedMonth);
    } catch (error) {
      throw new NextFitDreError(
        "COMPETENCE_REQUIRED",
        error instanceof Error ? error.message : "Última competência apurada inválida.",
      );
    }
    const warnings: NextFitDreWarning[] = [...parsed.warnings];
    const duplicateCanReceiveSnapshot = Boolean(
      duplicateBatch
      && !duplicateBatch.hasSnapshot
      && duplicateBatch.status === "VALIDATED"
      && duplicateBatch.competence === exercise.lastClosedCompetence,
    );
    if (duplicateBatch?.hasSnapshot) {
      warnings.unshift({
        code: "DUPLICATE_FILE",
        message: `O arquivo já foi registrado em ${new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(duplicateBatch.importedAt))}.`,
        severity: "ERROR",
      });
    } else if (duplicateBatch && duplicateCanReceiveSnapshot) {
      warnings.unshift({
        code: "SNAPSHOT_MISSING",
        message: "O lote histórico deste arquivo ainda não possui fotografia. A confirmação completará o mesmo lote sem criar duplicidade.",
        severity: "INFO",
      });
    } else if (duplicateBatch) {
      warnings.unshift({
        code: "SNAPSHOT_CONFLICT",
        message: "O ano, a última competência ou o status informado diverge do lote histórico. Nenhuma fotografia pode ser anexada.",
        severity: "ERROR",
      });
    }
    return {
      fileName,
      fileHash,
      year: parsed.year,
      sheetNames: parsed.sheetNames,
      competences: parsed.competences,
      competenceCount: parsed.competences.length,
      exercise,
      groups: parsed.groups,
      keyFigures: parsed.keyFigures,
      lines: parsed.lines,
      lineCount: parsed.lines.length,
      totalCheckCount: parsed.lines.filter((line) => line.total).length,
      totalMatchCount: parsed.lines.filter((line) => line.total?.matches).length,
      totalMismatchCount: parsed.lines.filter((line) => line.total && !line.total.matches).length,
      warnings,
      duplicateBatch: duplicateBatch ?? undefined,
      canConfirm: (!duplicateBatch || duplicateCanReceiveSnapshot) && parsed.competences.length > 0,
    };
  }

  return {
    inspect,

    async confirm(input: {
      readonly fileName: string;
      readonly bytes: Uint8Array;
      readonly expectedHash: string;
      readonly importedByUserId: string;
      readonly baseYear?: number;
      readonly lastClosedMonth?: number;
    }): Promise<ConfirmedNextFitDreBatch> {
      const preview = await inspect(
        input.fileName,
        input.bytes,
        input.baseYear,
        input.lastClosedMonth,
      );
      if (preview.fileHash !== input.expectedHash) {
        throw new NextFitDreError(
          "FILE_CHANGED",
          "O arquivo mudou depois da prévia. Gere uma nova prévia antes de confirmar.",
        );
      }
      const parsed = await readNextFitDreWorkbook(input.bytes, { baseYear: preview.year });
      const snapshot = buildNextFitDreSnapshot(parsed, preview.exercise);
      if (preview.duplicateBatch?.hasSnapshot) {
        throw new NextFitDreError(
          "SNAPSHOT_ALREADY_EXISTS",
          "Este lote já possui uma fotografia DRE e não foi sobrescrito.",
        );
      }
      if (preview.duplicateBatch) {
        if (!preview.canConfirm) {
          throw new NextFitDreError(
            "SNAPSHOT_CONFLICT",
            "O arquivo ou a competência diverge do lote histórico. Nenhuma fotografia foi anexada.",
          );
        }
        return repository.attachSnapshot({
          batchId: preview.duplicateBatch.id,
          fileHash: preview.fileHash,
          competence: preview.exercise.lastClosedCompetence,
          snapshot,
        });
      }
      return repository.createValidated({
        fileName: preview.fileName,
        fileHash: preview.fileHash,
        competence: preview.exercise.lastClosedCompetence,
        importedByUserId: input.importedByUserId,
        snapshot,
      });
    },
  };
}

export const nextFitDreService = createNextFitDreService();
