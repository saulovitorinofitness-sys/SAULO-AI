"use client";

import { useState } from "react";

import { FormField, Input, Select, Textarea } from "@/components/ui";
import {
  EXERCISE_BODY_REGIONS,
  EXERCISE_CLASSIFICATIONS,
  EXERCISE_DIFFICULTIES,
  EXERCISE_EQUIPMENT,
  EXERCISE_MODALITIES,
  EXERCISE_MOVEMENT_PATTERNS,
  EXERCISE_OBJECTIVES,
} from "@/features/scientific-library/exercise-metadata";
import {
  SCIENTIFIC_LIBRARY_STATUSES,
  scientificLibraryStatusLabels,
  type ScientificLibraryDraft,
} from "@/features/scientific-library/management-contracts";

type Props = {
  draft: ScientificLibraryDraft;
  onChange: (draft: ScientificLibraryDraft) => void;
  onDirty: () => void;
  tags: string;
  onTagsChange: (value: string) => void;
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-xl border border-[var(--line)] p-4 md:grid-cols-2">
      <legend className="px-2 text-sm font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">{title}</legend>
      {children}
    </fieldset>
  );
}

function Checklist({ id, label, options, value, onChange }: {
  id: string;
  label: string;
  options: readonly string[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-black text-[var(--text-primary)]">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option, index) => {
          const checked = value.includes(option);
          const inputId = `${id}-${index}`;
          return (
            <label className="cursor-pointer" htmlFor={inputId} key={option}>
              <input
                checked={checked}
                className="peer sr-only"
                id={inputId}
                onChange={() => onChange(checked ? value.filter((entry) => entry !== option) : [...value, option])}
                type="checkbox"
              />
              <span className="inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary-soft)] peer-checked:text-[var(--primary)]">
                {option}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function lines(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value.join("\n") : typeof value === "string" ? value : "";
}

function list(value: string) {
  return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function ListField({ id, label, help, value, onChange, onDirty }: {
  id: string;
  label: string;
  help?: string;
  value: string | readonly string[] | undefined;
  onChange: (value: string[]) => void;
  onDirty: () => void;
}) {
  const [text, setText] = useState(() => lines(value));
  return (
    <FormField help={help} id={id} label={label}>
      <Textarea
        id={id}
        onBlur={() => onChange(list(text))}
        onChange={(event) => { setText(event.target.value); onDirty(); }}
        value={text}
      />
    </FormField>
  );
}

export function ScientificExerciseFields({ draft, onChange, onDirty, tags, onTagsChange }: Props) {
  const stringValue = (key: string) => typeof draft.attributes[key] === "string" ? draft.attributes[key] as string : "";
  const listValue = (key: string) => Array.isArray(draft.attributes[key]) ? draft.attributes[key] as string[] : [];
  const setAttribute = (key: string, value: string | string[]) => onChange({ ...draft, attributes: { ...draft.attributes, [key]: value } });

  return (
    <>
      <Block title="1 — Identificação">
        <div className="md:col-span-2"><FormField id="knowledge-name" label="Nome ou título" required><Input autoFocus id="knowledge-name" maxLength={200} onChange={(event) => onChange({ ...draft, name: event.target.value })} required value={draft.name} /></FormField></div>
        <FormField id="exercise-modality" label="Modalidade"><Select id="exercise-modality" onChange={(event) => setAttribute("Modalidade", event.target.value)} value={stringValue("Modalidade")}><option value="">Não informado</option>{EXERCISE_MODALITIES.map((option) => <option key={option}>{option}</option>)}</Select></FormField>
        <FormField id="exercise-movement" label="Padrão de movimento"><Select id="exercise-movement" onChange={(event) => setAttribute("Padrão de movimento", event.target.value)} value={stringValue("Padrão de movimento")}><option value="">Não informado</option>{EXERCISE_MOVEMENT_PATTERNS.map((option) => <option key={option}>{option}</option>)}</Select></FormField>
        {stringValue("Modalidade") === "Outro" ? <FormField id="exercise-modality-other" label="Modalidade complementar"><Input id="exercise-modality-other" onChange={(event) => setAttribute("Modalidade complementar", event.target.value)} value={stringValue("Modalidade complementar")} /></FormField> : null}
        {stringValue("Padrão de movimento") === "Outro" ? <FormField id="exercise-movement-other" label="Padrão complementar"><Input id="exercise-movement-other" onChange={(event) => setAttribute("Padrão de movimento complementar", event.target.value)} value={stringValue("Padrão de movimento complementar")} /></FormField> : null}
        <div className="md:col-span-2"><Checklist id="exercise-classification" label="Classificação do exercício" onChange={(value) => setAttribute("Classificações", value)} options={EXERCISE_CLASSIFICATIONS} value={listValue("Classificações")} /></div>
        {listValue("Classificações").includes("Outro") ? <FormField id="exercise-classification-other" label="Classificação complementar"><Input id="exercise-classification-other" onChange={(event) => setAttribute("Classificação complementar", event.target.value)} value={stringValue("Classificação complementar")} /></FormField> : null}
        <FormField id="exercise-difficulty" label="Nível de dificuldade" help="Referência profissional; não bloqueia a prescrição."><Select id="exercise-difficulty" onChange={(event) => setAttribute("Nível de dificuldade", event.target.value)} value={stringValue("Nível de dificuldade")}><option value="">Não informado</option>{EXERCISE_DIFFICULTIES.map((option) => <option key={option}>{option}</option>)}</Select></FormField>
      </Block>

      <Block title="2 — Anatomia / aplicação">
        <div className="md:col-span-2"><Checklist id="exercise-region" label="Grupos musculares / regiões" onChange={(value) => setAttribute("Grupos musculares / regiões", value)} options={EXERCISE_BODY_REGIONS} value={listValue("Grupos musculares / regiões")} /></div>
        <ListField help="Um músculo ou grupo por linha." id="exercise-primary-muscles" label="Músculos primários" onChange={(value) => setAttribute("Músculos primários", value)} onDirty={onDirty} value={draft.attributes["Músculos primários"]} />
        <ListField help="Opcional; um por linha." id="exercise-secondary-muscles" label="Músculos secundários / sinergistas" onChange={(value) => setAttribute("Músculos secundários / sinergistas", value)} onDirty={onDirty} value={draft.attributes["Músculos secundários / sinergistas"]} />
        <div className="md:col-span-2"><Checklist id="exercise-objective" label="Objetivos / aplicações" onChange={(value) => setAttribute("Objetivos / aplicações", value)} options={EXERCISE_OBJECTIVES} value={listValue("Objetivos / aplicações")} /></div>
        {listValue("Objetivos / aplicações").includes("Outro") ? <ListField id="exercise-objective-other" label="Aplicações complementares" onChange={(value) => setAttribute("Aplicações complementares", value)} onDirty={onDirty} value={draft.attributes["Aplicações complementares"]} /> : null}
        <div className="md:col-span-2"><Checklist id="exercise-equipment" label="Equipamentos" onChange={(value) => setAttribute("Equipamentos", value)} options={EXERCISE_EQUIPMENT} value={listValue("Equipamentos")} /></div>
        {listValue("Grupos musculares / regiões").includes("Outra região") ? <ListField id="exercise-region-other" label="Regiões complementares" onChange={(value) => setAttribute("Regiões complementares", value)} onDirty={onDirty} value={draft.attributes["Regiões complementares"]} /> : null}
        <FormField id="exercise-equipment-other" label="Equipamento complementar"><Input id="exercise-equipment-other" onChange={(event) => setAttribute("Equipamento complementar", event.target.value)} value={stringValue("Equipamento complementar")} /></FormField>
      </Block>

      <Block title="3 — Execução">
        <FormField id="exercise-start-position" label="Posição inicial"><Textarea id="exercise-start-position" onChange={(event) => setAttribute("Posição inicial", event.target.value)} value={stringValue("Posição inicial")} /></FormField>
        <FormField id="exercise-execution" label="Execução técnica" help="Sequência, postura, amplitude, controle, respiração e segurança."><Textarea id="exercise-execution" maxLength={3000} onChange={(event) => setAttribute("Execução técnica", event.target.value)} value={stringValue("Execução técnica")} /></FormField>
        <ListField help="Um item por linha." id="exercise-common-errors" label="Erros comuns" onChange={(value) => setAttribute("Erros comuns", value)} onDirty={onDirty} value={draft.attributes["Erros comuns"]} />
        <FormField id="exercise-cautions" label="Cuidados / restrições profissionais" help="Cuidados biomecânicos e necessidade de adaptação; sem diagnóstico ou contraindicação automática."><Textarea id="exercise-cautions" onChange={(event) => setAttribute("Cuidados / restrições profissionais", event.target.value)} value={stringValue("Cuidados / restrições profissionais")} /></FormField>
      </Block>

      <Block title="4 — Variações">
        <ListField help="Nomes ou variações, um por linha; preparado para vínculo futuro." id="exercise-regressions" label="Regressões" onChange={(value) => setAttribute("Regressões", value)} onDirty={onDirty} value={draft.attributes.Regressões} />
        <ListField help="Nomes ou variações, um por linha; preparado para vínculo futuro." id="exercise-progressions" label="Progressões" onChange={(value) => setAttribute("Progressões", value)} onDirty={onDirty} value={draft.attributes.Progressões} />
        <ListField help="Uma alternativa por linha; sem substituição automática." id="exercise-alternatives" label="Alternativas / substituições" onChange={(value) => setAttribute("Alternativas / substituições", value)} onDirty={onDirty} value={draft.attributes["Alternativas / substituições"]} />
      </Block>

      <Block title="5 — Referência">
        <FormField id="knowledge-description" label="Descrição geral"><Textarea id="knowledge-description" maxLength={3000} onChange={(event) => onChange({ ...draft, description: event.target.value })} value={draft.description} /></FormField>
        <FormField id="knowledge-tags" label="Tags" help="Separe por vírgula, ponto e vírgula ou barra vertical."><Input id="knowledge-tags" onChange={(event) => onTagsChange(event.target.value)} value={tags} /></FormField>
        <FormField id="knowledge-source" label="Fonte ou origem"><Input id="knowledge-source" maxLength={500} onChange={(event) => onChange({ ...draft, source: event.target.value })} value={draft.source} /></FormField>
        <FormField id="professional-notes" label="Observações profissionais"><Textarea id="professional-notes" maxLength={3000} onChange={(event) => onChange({ ...draft, professionalNotes: event.target.value })} value={draft.professionalNotes} /></FormField>
        <FormField id="exercise-video-url" label="URL de vídeo demonstrativo"><Input id="exercise-video-url" onChange={(event) => setAttribute("URL de vídeo demonstrativo", event.target.value)} type="url" value={stringValue("URL de vídeo demonstrativo")} /></FormField>
        <FormField id="exercise-image-url" label="URL de imagem"><Input id="exercise-image-url" onChange={(event) => setAttribute("URL de imagem demonstrativa", event.target.value)} type="url" value={stringValue("URL de imagem demonstrativa")} /></FormField>
        <FormField id="knowledge-status" label="Status" required><Select id="knowledge-status" onChange={(event) => onChange({ ...draft, status: event.target.value as ScientificLibraryDraft["status"] })} value={draft.status}>{SCIENTIFIC_LIBRARY_STATUSES.map((status) => <option key={status} value={status}>{scientificLibraryStatusLabels[status]}</option>)}</Select></FormField>
        <p className="md:col-span-2 text-xs text-[var(--muted)]">Parâmetros individuais de treino pertencem à prescrição e não fazem parte deste cadastro.</p>
      </Block>
    </>
  );
}
