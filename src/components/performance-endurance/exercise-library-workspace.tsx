"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import {
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_CATEGORY_OPTIONS,
} from "@/features/performance-endurance/exercise-library-contracts";
import type {
  ExerciseCategory,
  ExerciseLibraryDraft,
  ExerciseLibraryItemView,
  ExerciseLibrarySearchResult,
} from "@/features/performance-endurance/exercise-library-contracts";

const emptyDraft: ExerciseLibraryDraft = {
  name: "",
  category: "STRENGTH",
  muscleGroup: "",
  equipment: "",
  description: "",
  executionInstructions: "",
  professionalNotes: "",
  active: true,
};

export function ExerciseLibraryWorkspace() {
  const [items, setItems] = useState<readonly ExerciseLibraryItemView[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | "ALL">("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [draft, setDraft] = useState<ExerciseLibraryDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (category !== "ALL") params.set("category", category);
    if (status !== "ALL") params.set("status", status);
    const response = await fetch(`/api/performance/exercises?${params}`, {
      headers: developmentUserRequestHeaders(),
    });
    const result = (await response.json().catch(() => null)) as
      | (ExerciseLibrarySearchResult & { message?: string })
      | { message?: string }
      | null;
    if (!response.ok || !result || !("items" in result)) {
      setMessage(result?.message ?? "Não foi possível carregar a biblioteca.");
      setLoading(false);
      return;
    }
    setItems(result.items);
    setLoading(false);
  }, [category, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 250);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  function openEdit(item: ExerciseLibraryItemView) {
    setDraft({
      name: item.name,
      category: item.category,
      muscleGroup: item.muscleGroup,
      equipment: item.equipment,
      description: item.description,
      executionInstructions: item.executionInstructions,
      professionalNotes: item.professionalNotes,
      active: item.active,
    });
    setEditingId(item.id);
    setEditorOpen(true);
    setMessage("");
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/performance/exercises/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify(draft),
      });
    const result = (await response.json().catch(() => null)) as
      | { exercise?: ExerciseLibraryItemView; message?: string }
      | null;
    if (!response.ok || !result?.exercise) {
      setMessage(result?.message ?? "Não foi possível salvar o exercício.");
      setSaving(false);
      return;
    }
    setMessage("Exercício legado atualizado.");
    setEditorOpen(false);
    setEditingId(undefined);
    setDraft(emptyDraft);
    setSaving(false);
    await loadItems();
  }

  async function toggleActive(item: ExerciseLibraryItemView) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/performance/exercises/${item.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...developmentUserRequestHeaders(),
      },
      body: JSON.stringify({ ...item, active: !item.active }),
    });
    const result = (await response.json().catch(() => null)) as
      | { exercise?: ExerciseLibraryItemView; message?: string }
      | null;
    if (!response.ok || !result?.exercise) {
      setMessage(result?.message ?? "Não foi possível alterar o status.");
      setSaving(false);
      return;
    }
    setMessage(item.active ? "Exercício inativado." : "Exercício ativado.");
    setSaving(false);
    await loadItems();
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden" variant="elevated">
        <div className="bg-[var(--primary)] px-5 py-6 text-white md:px-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
            Performance · Fundação profissional
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 className="text-2xl font-black md:text-3xl">Biblioteca de Exercícios</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">
                  Catálogo mestre reutilizado da Biblioteca Científica. Séries, carga, pace, zonas e outras métricas permanecem na prescrição.
                </p>
              </div>
              <ButtonLink href="/administracao/biblioteca-cientifica" variant="secondary">
                Cadastrar na Biblioteca Científica
              </ButtonLink>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 p-4 md:px-7">
          <ButtonLink href="/pacientes" size="small" variant="outline">
            Voltar para pacientes
          </ButtonLink>
        </div>
      </Card>

      {editorOpen ? (
        <Card className="p-5 md:p-6">
          <h2 className="text-xl font-black text-[var(--text-primary)]">
            {editingId ? "Editar exercício" : "Novo exercício"}
          </h2>
          <form className="mt-5 grid gap-4" onSubmit={saveExercise}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="exercise-name" label="Nome do exercício" required>
                <Input
                  autoFocus
                  id="exercise-name"
                  maxLength={180}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  value={draft.name}
                />
              </FormField>
              <FormField id="exercise-category" label="Modalidade ou categoria" required>
                <Select
                  id="exercise-category"
                  onChange={(event) => setDraft({ ...draft, category: event.target.value as ExerciseCategory })}
                  required
                  value={draft.category}
                >
                  {EXERCISE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{EXERCISE_CATEGORY_LABELS[option]}</option>
                  ))}
                </Select>
              </FormField>
              <FormField id="exercise-muscle" label="Grupo muscular ou região corporal" help="Preencha quando aplicável.">
                <Input id="exercise-muscle" maxLength={120} onChange={(event) => setDraft({ ...draft, muscleGroup: event.target.value })} value={draft.muscleGroup} />
              </FormField>
              <FormField id="exercise-equipment" label="Equipamento" help="Preencha quando aplicável.">
                <Input id="exercise-equipment" maxLength={120} onChange={(event) => setDraft({ ...draft, equipment: event.target.value })} value={draft.equipment} />
              </FormField>
            </div>
            <FormField id="exercise-description" label="Descrição">
              <Textarea id="exercise-description" maxLength={1000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description} />
            </FormField>
            <FormField id="exercise-execution" label="Orientação de execução">
              <Textarea id="exercise-execution" maxLength={2000} onChange={(event) => setDraft({ ...draft, executionInstructions: event.target.value })} value={draft.executionInstructions} />
            </FormField>
            <FormField id="exercise-notes" label="Observações profissionais">
              <Textarea id="exercise-notes" maxLength={2000} onChange={(event) => setDraft({ ...draft, professionalNotes: event.target.value })} value={draft.professionalNotes} />
            </FormField>
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-[var(--text-secondary)]" htmlFor="exercise-active">
              <Checkbox checked={draft.active} id="exercise-active" onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              Exercício ativo e disponível para reutilização
            </label>
            <div className="flex flex-wrap gap-3">
              <Button loading={saving} type="submit">{editingId ? "Salvar alterações" : "Cadastrar exercício"}</Button>
              <Button disabled={saving} onClick={() => setEditorOpen(false)} type="button" variant="outline">Cancelar</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="p-5 md:p-6">
        <h2 className="text-xl font-black text-[var(--text-primary)]">Catálogo mestre de exercícios</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FormField id="exercise-search" label="Pesquisar">
            <Input id="exercise-search" onChange={(event) => setQuery(event.target.value)} placeholder="Nome, região ou equipamento" type="search" value={query} />
          </FormField>
          <FormField id="exercise-filter-category" label="Categoria">
            <Select id="exercise-filter-category" onChange={(event) => setCategory(event.target.value as ExerciseCategory | "ALL")} value={category}>
              <option value="ALL">Todas</option>
              {EXERCISE_CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{EXERCISE_CATEGORY_LABELS[option]}</option>)}
            </Select>
          </FormField>
          <FormField id="exercise-filter-status" label="Status">
            <Select id="exercise-filter-status" onChange={(event) => setStatus(event.target.value as typeof status)} value={status}>
              <option value="ALL">Ativos e inativos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
            </Select>
          </FormField>
        </div>

        <p aria-live="polite" className="mt-4 min-h-5 text-sm font-semibold text-[var(--text-secondary)]" role="status">
          {message || (loading ? "Carregando exercícios..." : `${items.length} exercício(s) encontrado(s).`)}
        </p>

        {!loading && !items.length ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-elevated)] p-8 text-center text-sm text-[var(--muted)]">
            Nenhum exercício encontrado para os filtros selecionados.
          </div>
        ) : (
          <ul className="mt-4 grid gap-4" aria-label="Exercícios cadastrados">
            {items.map((item) => (
              <li className="rounded-2xl border border-[var(--line)] p-4 md:p-5" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-[var(--text-primary)]">{item.name}</h3>
                      <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Ativo" : "Inativo"}</Badge>
                      <Badge>{EXERCISE_CATEGORY_LABELS[item.category]}</Badge>
                      <Badge tone="info">{item.sourceKind === "SCIENTIFIC_LIBRARY" ? "Biblioteca Científica" : "Legado preservado"}</Badge>
                    </div>
                    {(item.muscleGroup || item.equipment) ? (
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        {[item.muscleGroup, item.equipment].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {item.description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{item.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.sourceKind === "SCIENTIFIC_LIBRARY" ? (
                      <ButtonLink href="/administracao/biblioteca-cientifica" size="small" variant="outline">Gerenciar na fonte mestre</ButtonLink>
                    ) : <>
                      <Button disabled={saving} onClick={() => openEdit(item)} size="small" type="button" variant="outline">Editar legado</Button>
                      <Button disabled={saving} onClick={() => void toggleActive(item)} size="small" type="button" variant="ghost">{item.active ? "Inativar" : "Ativar"}</Button>
                    </>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
