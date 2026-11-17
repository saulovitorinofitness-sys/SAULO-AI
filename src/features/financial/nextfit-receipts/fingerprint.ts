import { createHash } from "node:crypto";

import type { ValidatedNextFitReceiptRow } from "./contracts";
import { normalizeNextFitText } from "./mapping";

export type NextFitReceiptRowBeforeFingerprint = Omit<
  ValidatedNextFitReceiptRow,
  "fingerprint" | "occurrence"
>;

function canonicalValue(value: unknown): string {
  return normalizeNextFitText(value).replace(/\|/g, "\\|");
}

export function getNextFitReceiptCanonicalKey(
  row: NextFitReceiptRowBeforeFingerprint,
): string {
  return [
    row.receiptDate,
    row.openingDate ?? "",
    row.closingDate ?? "",
    row.origin ?? "",
    row.cashRegister ?? "",
    row.rawMethod,
    row.method,
    row.rawType,
    row.amount,
  ]
    .map(canonicalValue)
    .join("|");
}

export function fingerprintNextFitReceiptRows(
  rows: readonly NextFitReceiptRowBeforeFingerprint[],
): ValidatedNextFitReceiptRow[] {
  const occurrences = new Map<string, number>();

  return rows.map((row) => {
    const canonicalKey = getNextFitReceiptCanonicalKey(row);
    const occurrence = (occurrences.get(canonicalKey) ?? 0) + 1;
    occurrences.set(canonicalKey, occurrence);

    const fingerprint = createHash("sha256")
      .update(`nextfit-receipt@1|${canonicalKey}|${occurrence}`)
      .digest("hex");

    return { ...row, fingerprint, occurrence };
  });
}
