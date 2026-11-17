import { createHash } from "node:crypto";

export function canonicalSalaryJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalSalaryJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalSalaryJson(entry)}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError("Valor nao serializavel no snapshot.");
  return serialized;
}

export function canonicalSnapshotSha256(value: unknown): string {
  return createHash("sha256").update(canonicalSalaryJson(value), "utf8").digest("hex");
}
