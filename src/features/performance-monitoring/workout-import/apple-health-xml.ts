import { createHash } from "node:crypto";

import type { PerformanceModality } from "../contracts";
import type { ParsedWorkoutRecord } from "./contracts";

const MAX_XML_BYTES = 10 * 1024 * 1024;
const WORKOUT_PATTERN = /<Workout\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Workout\s*>)/g;
const ATTRIBUTE_PATTERN = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export class AppleHealthWorkoutXmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleHealthWorkoutXmlError";
  }
}

function decodeXml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function attributes(source: string) {
  const result = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    result.set(match[1], decodeXml(match[2] ?? match[3] ?? ""));
  }
  return result;
}

function appleDate(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/,
    "$1T$2$3:$4",
  );
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function positiveNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function durationSeconds(value: string | undefined, unit: string | undefined) {
  const duration = positiveNumber(value);
  if (duration === undefined || !unit) return undefined;
  const normalized = unit.toLocaleLowerCase("en-US");
  const multiplier = normalized.startsWith("sec")
    ? 1
    : normalized.startsWith("min")
      ? 60
      : normalized.startsWith("hour") || normalized === "hr"
        ? 3_600
        : undefined;
  return multiplier ? Math.round(duration * multiplier) : undefined;
}

function distanceMeters(value: string | undefined, unit: string | undefined) {
  const distance = positiveNumber(value);
  if (distance === undefined || !unit) return undefined;
  const multiplier: Readonly<Record<string, number>> = {
    km: 1_000,
    m: 1,
    mi: 1_609.344,
    yd: 0.9144,
  };
  const factor = multiplier[unit.toLocaleLowerCase("en-US")];
  return factor ? distance * factor : undefined;
}

function modality(activityType: string | undefined): PerformanceModality {
  const type = activityType?.replace("HKWorkoutActivityType", "") ?? "";
  if (type === "Running") return "RUNNING";
  if (type === "Cycling" || type === "HandCycling") return "CYCLING";
  if (
    type === "TraditionalStrengthTraining" ||
    type === "FunctionalStrengthTraining" ||
    type === "CoreTraining"
  ) {
    return "STRENGTH";
  }
  return "OTHER";
}

function externalIdentifier(
  workoutAttributes: Map<string, string>,
  body: string,
  stableFields: readonly (string | number | undefined)[],
) {
  const metadata = /<MetadataEntry\b([^>]*?)\/?\s*>/g;
  for (const match of body.matchAll(metadata)) {
    const entry = attributes(match[1]);
    if (entry.get("key") === "HKExternalUUID" && entry.get("value")) {
      return entry.get("value") as string;
    }
  }
  if (workoutAttributes.get("uuid")) return workoutAttributes.get("uuid") as string;
  return createHash("sha256").update(stableFields.join("|")).digest("hex");
}

/** Reads Apple Health workouts only. Record, ActivitySummary and clinical data are ignored. */
export function parseAppleHealthWorkoutXml(xml: string): readonly ParsedWorkoutRecord[] {
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) {
    throw new AppleHealthWorkoutXmlError("O XML deve ter no máximo 10 MB.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new AppleHealthWorkoutXmlError("O XML contém declarações não permitidas.");
  }

  const workouts: ParsedWorkoutRecord[] = [];
  let recordIndex = 0;
  for (const match of xml.matchAll(WORKOUT_PATTERN)) {
    const workoutAttributes = attributes(match[1]);
    const body = match[2] ?? "";
    const startedAt = appleDate(workoutAttributes.get("startDate"));
    if (!startedAt) {
      recordIndex += 1;
      continue;
    }
    const endedAt = appleDate(workoutAttributes.get("endDate"));
    const duration = durationSeconds(
      workoutAttributes.get("duration"),
      workoutAttributes.get("durationUnit"),
    );
    const distance = distanceMeters(
      workoutAttributes.get("totalDistance"),
      workoutAttributes.get("totalDistanceUnit"),
    );
    const workoutModality = modality(workoutAttributes.get("workoutActivityType"));
    const identifier = externalIdentifier(workoutAttributes, body, [
      workoutAttributes.get("workoutActivityType"),
      startedAt,
      endedAt,
      duration,
      distance,
      recordIndex,
    ]);
    workouts.push({
      id: createHash("sha256").update(`APPLE_HEALTH:${identifier}`).digest("hex"),
      provider: "APPLE_HEALTH",
      externalIdentifier: identifier,
      modality: workoutModality,
      startedAt,
      endedAt,
      durationSeconds: duration,
      distanceMeters: distance,
    });
    recordIndex += 1;
  }

  if (workouts.length === 0) {
    throw new AppleHealthWorkoutXmlError(
      "Nenhum registro de treino válido foi encontrado no XML.",
    );
  }
  return workouts;
}
