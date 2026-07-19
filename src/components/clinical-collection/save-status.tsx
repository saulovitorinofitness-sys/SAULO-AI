import type { SaveState } from "@/features/clinical-collection";

const config = {
  IDLE: { label: "Sem alterações", dot: "bg-slate-300", text: "text-slate-500" },
  UNSAVED: { label: "Alterações não salvas", dot: "bg-amber-500", text: "text-amber-800" },
  SAVING: { label: "Salvando...", dot: "animate-pulse bg-sky-500", text: "text-sky-800" },
  SAVED: { label: "Salvo no mock", dot: "bg-emerald-500", text: "text-emerald-800" },
  ERROR: { label: "Erro ao salvar", dot: "bg-rose-500", text: "text-rose-800" },
};

export function SaveStatus({ state }: { state: SaveState }) {
  const item = config[state];
  return <span aria-live="polite" className={`inline-flex items-center gap-2 text-xs font-bold ${item.text}`} role="status"><span className={`size-2 rounded-full ${item.dot}`} />{item.label}</span>;
}
