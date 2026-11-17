"use client";

import { FileUp, Watch, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Badge, Button } from "@/components/ui";
import type {
  PerformanceModality,
} from "@/features/performance-monitoring/contracts";

const PREVIEW_PATH = "/api/performance-monitoring/imports/apple-health/preview";
const CONFIRM_PATH = "/api/performance-monitoring/imports/apple-health/confirm";

interface PreviewWorkout {
  readonly id: string;
  readonly modality: PerformanceModality;
  readonly startedAt: string;
  readonly durationSeconds?: number;
  readonly distanceMeters?: number;
}

const modalityLabels: Readonly<Record<PerformanceModality, string>> = {
  STRENGTH: "Musculação",
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  OTHER: "Outra modalidade",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageFrom(value: unknown) {
  return isObject(value) && typeof value.message === "string"
    ? value.message
    : undefined;
}

function isPreviewWorkout(value: unknown): value is PreviewWorkout {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.startedAt === "string" &&
    (value.modality === "STRENGTH" ||
      value.modality === "RUNNING" ||
      value.modality === "CYCLING" ||
      value.modality === "OTHER") &&
    (value.durationSeconds === undefined ||
      typeof value.durationSeconds === "number") &&
    (value.distanceMeters === undefined ||
      typeof value.distanceMeters === "number")
  );
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function duration(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }
  return seconds ? `${minutes}min ${seconds}s` : `${minutes} min`;
}

function distance(value: number) {
  return value >= 1_000
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value / 1_000)} km`
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)} m`;
}

export function AppleHealthWorkoutImport({
  masterRecordId,
  patientName,
  onImported,
}: {
  readonly masterRecordId: string;
  readonly patientName: string;
  readonly onImported: (message: string) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [workouts, setWorkouts] = useState<readonly PreviewWorkout[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function reset() {
    setFile(undefined);
    setWorkouts([]);
    setSelected(new Set());
    setError(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cancel() {
    reset();
    setOpen(false);
  }

  async function preview() {
    if (!file || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(PREVIEW_PATH, { method: "POST", body: form });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(messageFrom(payload) ?? "Não foi possível ler o XML.");
      }
      const parsed = isObject(payload) && Array.isArray(payload.workouts)
        ? payload.workouts.filter(isPreviewWorkout)
        : [];
      if (parsed.length === 0) throw new Error("A prévia não contém treinos válidos.");
      setWorkouts(parsed);
      setSelected(new Set(parsed.map((workout) => workout.id)));
    } catch (previewError) {
      setWorkouts([]);
      setSelected(new Set());
      setError(previewError instanceof Error ? previewError.message : "Não foi possível ler o XML.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file || selected.size === 0 || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("masterRecordId", masterRecordId);
      for (const id of selected) form.append("selectedId", id);
      const response = await fetch(CONFIRM_PATH, { method: "POST", body: form });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(messageFrom(payload) ?? "Não foi possível importar os treinos.");
      }
      const imported = isObject(payload) && Array.isArray(payload.importedIds)
        ? payload.importedIds.length
        : 0;
      const duplicates = isObject(payload) && Array.isArray(payload.duplicateIds)
        ? payload.duplicateIds.length
        : 0;
      cancel();
      onImported(
        duplicates > 0
          ? `${imported} treino(s) importado(s); ${duplicates} já existia(m) e não foi(ram) duplicado(s).`
          : `${imported} treino(s) importado(s) com sucesso.`,
      );
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Não foi possível importar os treinos.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-sky-950">Treinos do Apple Watch</p>
          <p className="mt-1 text-sm text-sky-800">Importe manualmente um XML do app Saúde, um arquivo por vez.</p>
        </div>
        <Button onClick={() => setOpen(true)} type="button" variant="outline">
          <Watch aria-hidden="true" className="size-4" />
          Importar XML
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5" aria-labelledby={`${inputId}-title`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-black text-slate-950" id={`${inputId}-title`}>Importar treinos do Apple Watch</h3>
          <p className="mt-1 text-sm text-slate-600">Aluno selecionado: <strong>{patientName}</strong></p>
        </div>
        <Button aria-label="Cancelar importação" disabled={busy} onClick={cancel} size="icon" type="button" variant="ghost">
          <X aria-hidden="true" className="size-5" />
        </Button>
      </div>

      {workouts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-sky-300 bg-white p-4">
          <label className="block text-sm font-bold text-slate-800" htmlFor={inputId}>Arquivo XML do app Saúde</label>
          <input
            accept=".xml,text/xml,application/xml"
            className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:font-bold file:text-sky-900"
            id={inputId}
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setError(undefined);
            }}
            ref={inputRef}
            type="file"
          />
          <p className="mt-2 text-xs text-slate-500">Somente registros de treino são lidos. O XML não será armazenado. Máximo de 10 MB.</p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} onClick={cancel} type="button" variant="outline">Cancelar</Button>
            <Button disabled={!file || busy} loading={busy} onClick={preview} type="button">
              <FileUp aria-hidden="true" className="size-4" />
              Ver prévia
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-700">Escolha quais treinos serão importados.</p>
            <Badge tone="info">{selected.size} de {workouts.length} selecionado(s)</Badge>
          </div>
          <div className="mt-3 grid gap-2">
            {workouts.map((workout) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 focus-within:ring-2 focus-within:ring-sky-600" key={workout.id}>
                <input checked={selected.has(workout.id)} className="mt-1 size-4" onChange={() => toggle(workout.id)} type="checkbox" />
                <span className="min-w-0 flex-1">
                  <span className="font-black text-slate-950">{modalityLabels[workout.modality]}</span>
                  <span className="mt-1 block text-sm text-slate-700">{dateTime(workout.startedAt)}</span>
                  <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    {workout.durationSeconds !== undefined ? <span>Duração: {duration(workout.durationSeconds)}</span> : null}
                    {workout.distanceMeters !== undefined ? <span>Distância: {distance(workout.distanceMeters)}</span> : null}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} onClick={cancel} type="button" variant="outline">Cancelar sem gravar</Button>
            <Button disabled={selected.size === 0 || busy} loading={busy} onClick={confirm} type="button">Importar selecionados</Button>
          </div>
        </div>
      )}

      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800" role="alert">{error}</p> : null}
    </section>
  );
}
