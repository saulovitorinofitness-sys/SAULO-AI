import type { SessionUser } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";
import type { ImportFileFormat, ImportWorkspaceView, ParsedImportFile } from "./contracts";
import { importWorkspaceMock } from "./mock-data";

const formats = ["xlsx", "xls", "csv"] as const;
export function getImportFileFormat(fileName: string): ImportFileFormat | null { const extension = fileName.split(".").pop()?.toLowerCase(); return formats.includes(extension as ImportFileFormat) ? extension as ImportFileFormat : null; }

export async function parseLocalSpreadsheet(file: File): Promise<ParsedImportFile> {
  const format = getImportFileFormat(file.name);
  if (!format) throw new Error(file.name.toLowerCase().endsWith(".pdf") ? "Prefira o relatório em Excel ou CSV. A leitura estruturada de PDF será avaliada em etapa futura." : "Formato não suportado. Selecione XLSX, XLS ou CSV.");
  if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo excede o limite demonstrativo de 10 MB.");
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true, codepage: 65001 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Nenhuma planilha foi encontrada no arquivo.");
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });
  if (!matrix.length || !matrix[0]?.length) throw new Error("O arquivo não possui cabeçalho reconhecível.");
  const headers = matrix[0].map((cell, index) => String(cell ?? `Coluna ${index + 1}`).trim());
  const rawRows = matrix.slice(1).filter((row) => row.some((cell) => cell !== null && String(cell).trim() !== "")).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
  return { fileName: file.name, format, sizeBytes: file.size, selectedAt: new Date().toISOString(), sheetName, headers, rawRows };
}

export const businessImportService = {
  canAccess(user: SessionUser) { return user.id === BUILT_IN_IDS.users.sauloXavierVitorino; },
  async getWorkspace(user: SessionUser): Promise<ImportWorkspaceView | null> { return this.canAccess(user) ? structuredClone(importWorkspaceMock) : null; },
};
