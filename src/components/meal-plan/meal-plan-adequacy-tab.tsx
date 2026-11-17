"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import {
  DIETARY_REFERENCE_SOURCE,
  ageInCompletedYears,
  formatDietaryReferenceClinicalDate,
  normalizeDietaryReferenceSex,
  type DietaryReferenceLifeStage,
  type DietaryReferenceProfile,
  type DietaryReferenceValue,
  type DietaryReferenceSex,
} from "@/features/meal-plan/dietary-reference";
import {
  buildNutrientReviewGuidance,
  type NutrientReviewGuidance,
} from "@/features/meal-plan/adequacy-review-guidance";
import {
  analyzeMealPlanNutrition,
  type NutrientContributor,
  type PlannedNutrientTotal,
} from "@/features/meal-plan/plan-nutrition-analysis";
import type { MealPlanRecordMeal } from "@/features/meal-plan/record";

const coverageLabel = { COMPLETE: "Completo", PARTIAL: "Parcial", ABSENT: "Ausente" } as const;
const coverageTone = { COMPLETE: "success", PARTIAL: "warning", ABSENT: "neutral" } as const;
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const preciseNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

function requiredReferenceForm(reference: DietaryReferenceValue) {
  return reference.referenceRequiredForm ??
    (reference.nutrient === "folateMcg" ? "DFE" : reference.nutrient === "vitaminAMcg" ? "RAE" : undefined);
}

function nutrientUnit(reference: DietaryReferenceValue, nutrientForm: PlannedNutrientTotal["nutrientForm"]) {
  if (reference.nutrient === "folateMcg") {
    return nutrientForm === "DFE" ? "mcg DFE"
      : nutrientForm === "FOOD_FOLATE" ? "mcg de folato alimentar"
        : nutrientForm === "FOLIC_ACID" ? "mcg de ácido fólico"
          : nutrientForm === "MIXED" ? "mcg (formas mistas)"
            : "mcg de folato (forma não especificada)";
  }
  if (reference.nutrient === "vitaminAMcg") {
    return nutrientForm === "RAE" ? "mcg RAE"
      : nutrientForm === "RE" ? "mcg RE"
        : nutrientForm === "RETINOL" ? "mcg de retinol"
          : nutrientForm === "MIXED" ? "mcg (formas mistas)"
            : "mcg de vitamina A (forma não especificada)";
  }
  return reference.unit;
}

function plannedUnit(reference: DietaryReferenceValue, total: PlannedNutrientTotal) {
  return nutrientUnit(reference, total.nutrientForm);
}

function referenceComparable(reference: DietaryReferenceValue, total: PlannedNutrientTotal) {
  const required = requiredReferenceForm(reference);
  return !required || total.nutrientForm === required;
}

function upperReferenceUnit(reference: DietaryReferenceValue) {
  if (reference.ulRequiredForm === "FOLIC_ACID") return "mcg de ácido fólico";
  if (reference.ulRequiredForm === "RETINOL") return "mcg de vitamina A pré-formada";
  return reference.unit;
}

function upperReferenceLabel(reference: DietaryReferenceValue) {
  if (!reference.ul || reference.ulComparison === "NOT_ESTABLISHED") return "UL não estabelecido*";
  const type = reference.upperType ?? "UL";
  const value = `${type} ${preciseNumber.format(reference.ul)} ${upperReferenceUnit(reference)}`;
  return reference.ulComparison === "NOT_DETERMINABLE"
    ? `${value} · comparação não determinável`
    : value;
}

function CoverageDetails({ total }: { total: PlannedNutrientTotal }) {
  return <div className="min-w-0">
    <Badge tone={coverageTone[total.coverage]}>{coverageLabel[total.coverage]}</Badge>
    <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
      {total.completeItemCount} completos · {total.partialItemCount} com subtotal parcial · {total.absentItemCount} sem informação
    </span>
  </div>;
}

function prescribedQuantityLabel(item: NutrientContributor) {
  if (item.prescribedUnit === "SERVING") return item.prescribedQuantityLabel;
  return `${preciseNumber.format(item.prescribedAmount)} ${item.prescribedUnit}`;
}

function QuantityTrace({ item }: { item: NutrientContributor }) {
  if (item.itemType === "RECIPE") {
    return <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Quantidade prescrita: {prescribedQuantityLabel(item)}. A contribuição usa a porção do snapshot da receita, sem somar seus ingredientes novamente.</p>;
  }
  const basis = item.nutritionBasis;
  return <div className="mt-1 space-y-0.5 text-xs leading-5 text-[var(--muted)]">
    <p><strong>Quantidade prescrita:</strong> {prescribedQuantityLabel(item)}.</p>
    {item.selectedMeasureLabel && item.documentedEquivalent ? <p><strong>Medida caseira selecionada:</strong> {item.selectedMeasureLabel}. <strong>Equivalente documentado:</strong> {preciseNumber.format(item.documentedEquivalent.amount)} {item.documentedEquivalent.unit}.</p> : <p>Nenhuma medida caseira está vinculada de forma verificável a esta quantidade.</p>}
    {basis ? <p><strong>Base nutricional da fonte:</strong> {preciseNumber.format(basis.amount)} {basis.unit ?? "(unidade não identificada)"}.</p> : null}
    {item.quantityCompatibility === "MISSING_CONVERSION" ? <p className="font-semibold text-amber-800">A prescrição e a base usam unidades diferentes. O fator numérico preservado no snapshot é {item.nutritionCalculationFactor === undefined ? "não determinável" : preciseNumber.format(item.nutritionCalculationFactor)}, mas não há conversão documentada entre {item.prescribedUnit} e {basis?.unit ?? "a unidade da base"}.</p> : item.quantityCompatibility === "UNKNOWN" ? <p className="font-semibold text-amber-800">A unidade da base nutricional não está identificada no snapshot histórico; o fator não pode ser validado.</p> : item.nutritionCalculationFactor !== undefined && basis?.unit ? <p><strong>Fator aplicado à composição:</strong> {preciseNumber.format(item.nutritionCalculationFactor)} ({preciseNumber.format(item.prescribedAmount)} {item.prescribedUnit} ÷ {preciseNumber.format(basis.amount)} {basis.unit}).</p> : null}
  </div>;
}

function Contributors({
  total,
  reference,
}: {
  total: PlannedNutrientTotal;
  reference: DietaryReferenceValue;
}) {
  const known = total.contributors.filter((item) => item.knownAmount !== null && item.knownAmount > 0).slice(0, 10);
  const documentedZero = total.contributors.filter((item) => item.knownAmount === 0);
  const absent = total.contributors.filter((item) => item.knownAmount === null);
  return <div className="space-y-3">
    {known.length ? <ul className="space-y-2">
      {known.map((item) => <li className="rounded-lg border border-[var(--line)] bg-white/70 p-2.5" key={item.itemId}>
        <p className="font-bold">{item.itemName} <span className="font-normal text-[var(--muted)]">({item.itemType === "RECIPE" ? "receita" : "alimento"} · {item.mealName})</span></p>
        <QuantityTrace item={item} />
        <p className="text-xs leading-5 text-[var(--muted)]">Contribuição: {preciseNumber.format(item.knownAmount!)} {nutrientUnit(reference, item.nutrientForm)}{item.shareOfKnownTotalPercent === null ? "." : ` · ${number.format(item.shareOfKnownTotalPercent)}% do ${total.coverage === "COMPLETE" ? "total conhecido" : "subtotal conhecido"}.`} Cobertura: {coverageLabel[item.coverage].toLowerCase()}.</p>
      </li>)}
    </ul> : <p className="text-sm text-[var(--muted)]">Nenhum item tem contribuição positiva conhecida para este nutriente.</p>}
    {documentedZero.length ? <div><p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Zero documentado</p><ul className="mt-1 space-y-1 text-xs leading-5">{documentedZero.map((item) => <li key={item.itemId}>{item.itemName} · {prescribedQuantityLabel(item)} · 0 {nutrientUnit(reference, item.nutrientForm)}. O valor zero veio da composição; não é dado ausente.</li>)}</ul></div> : null}
    {absent.length ? <div><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Sem informação</p><ul className="mt-1 space-y-1 text-xs leading-5">{absent.map((item) => <li key={item.itemId}>{item.itemName} · {prescribedQuantityLabel(item)} · contribuição não determinável.</li>)}</ul></div> : null}
    <p className="text-xs leading-5 text-[var(--muted)]">A participação usa como denominador o {total.coverage === "COMPLETE" ? "total conhecido" : "subtotal conhecido"} de {total.knownAmount === null ? "valor indisponível" : `${preciseNumber.format(total.knownAmount)} ${nutrientUnit(reference, total.nutrientForm)}`}. A lista identifica fontes no plano; não identifica causas de exames ou efeitos no organismo.</p>
  </div>;
}

function NutrientReviewDetails({
  total,
  reference,
  guidance,
}: {
  total: PlannedNutrientTotal;
  reference: DietaryReferenceValue;
  guidance: NutrientReviewGuidance;
}) {
  return <div className="grid gap-5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 lg:grid-cols-3 lg:p-5">
    <section><h4 className="font-black">1. Resultado da comparação</h4><div className="mt-2 space-y-2 text-sm leading-6">{guidance.comparison.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
    <section><h4 className="font-black">2. Alimentos e receitas que contribuem</h4><div className="mt-2"><Contributors reference={reference} total={total} /></div></section>
    <section><h4 className="font-black">3. Possíveis ajustes para sua avaliação</h4><div className="mt-2 space-y-2 text-sm leading-6">{guidance.possibleAdjustment.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p className="text-[var(--muted)]">Nenhuma alteração foi aplicada. Se decidir trocar um item, use o mecanismo de substituições da Elaboração, que recalcula a partir da prescrição real; esta ajuda não simula equivalências.</p></div></section>
  </div>;
}

export function MealPlanAdequacyTab({
  meals,
  profile,
  references,
  patientSex,
  birthDate,
  attendanceDate,
  disabled,
  onProfileChange,
}: {
  meals: readonly MealPlanRecordMeal[];
  profile?: DietaryReferenceProfile;
  references?: readonly DietaryReferenceValue[];
  patientSex: "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
  birthDate: string;
  attendanceDate: string;
  disabled: boolean;
  onProfileChange(profile: DietaryReferenceProfile): void;
}) {
  const analysis = useMemo(() => analyzeMealPlanNutrition(meals), [meals]);
  const selectedReferences = references ?? null;
  const [editing, setEditing] = useState(false);
  const cadastroSex = normalizeDietaryReferenceSex(patientSex);
  const [sex, setSex] = useState<DietaryReferenceSex | "">(profile?.sex ?? cadastroSex ?? "");
  const [lifeStage, setLifeStage] = useState<DietaryReferenceLifeStage>(profile?.lifeStage ?? "UNKNOWN");
  const [reason, setReason] = useState("");
  const [expandedNutrients, setExpandedNutrients] = useState<ReadonlySet<string>>(() => new Set());
  const calculatedAge = ageInCompletedYears(birthDate, attendanceDate);
  const confirmsOnlyMissingLifeStage = lifeStage !== "UNKNOWN" &&
    (profile?.lifeStage ?? "UNKNOWN") === "UNKNOWN" &&
    sex === (profile?.sex ?? cadastroSex) &&
    calculatedAge !== null && calculatedAge === (profile?.ageYears ?? calculatedAge);
  const needsAdjustmentReason = !confirmsOnlyMissingLifeStage;
  const nutrientRows = (selectedReferences ?? []).map((reference) => {
    const total = analysis.nutrients[reference.nutrient];
    const comparable = referenceComparable(reference, total);
    const percent = comparable && total.knownAmount !== null
      ? (total.knownAmount / reference.referenceValue) * 100
      : null;
    const sourceUnit = plannedUnit(reference, total);
    const guidance = buildNutrientReviewGuidance({ reference, total, referenceComparable: comparable, sourceUnit });
    return { reference, total, comparable, percent, sourceUnit, guidance };
  });
  const toggleNutrient = (nutrient: string) => setExpandedNutrients((current) => {
    const next = new Set(current);
    if (next.has(nutrient)) next.delete(nutrient);
    else next.add(nutrient);
    return next;
  });

  return <div className="space-y-4">
    <Card className="p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Perfil de referência</p>
          {profile ? <>
            <h2 className="mt-1 text-lg font-black">{profile.sex === "FEMALE" ? "Feminino" : "Masculino"} · {profile.ageYears} anos · {profile.lifeStage === "PREGNANCY" ? "Gestação" : profile.lifeStage === "LACTATION" ? "Lactação" : profile.lifeStage === "NONE" ? "Sem gestação ou lactação" : "Fase de vida pendente"}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Idade na data do atendimento ({formatDietaryReferenceClinicalDate(profile.ageAt)}). Origem: {profile.origin === "PROFESSIONAL_ADJUSTMENT" ? "ajuste profissional persistido" : profile.origin === "PROFESSIONAL_CONFIRMATION" ? "fase de vida confirmada pelo profissional" : "cadastro e atendimento"}.</p>
            {profile.lifeStage === "UNKNOWN" ? <p className="mt-2 text-sm text-amber-800">Sexo e idade foram identificados no cadastro. Informe se havia gestação ou lactação na data do atendimento; a ausência dessas fases não será presumida.</p> : null}
            {profile.adjustmentReason ? <p className="mt-1 text-sm"><strong>Justificativa:</strong> {profile.adjustmentReason}</p> : null}
          </> : <>
            <h2 className="mt-1 text-lg font-black">Perfil DRI não determinável</h2>
            <p className="mt-1 text-sm text-amber-800">O cadastro informa sexo “{patientSex}”. Nenhum perfil padrão foi presumido. Nascimento: {formatDietaryReferenceClinicalDate(birthDate)}; atendimento: {formatDietaryReferenceClinicalDate(attendanceDate)}.</p>
          </>}
        </div>
        <Button disabled={disabled} onClick={() => setEditing((value) => !value)} type="button" variant="secondary">{editing ? "Cancelar" : profile?.lifeStage === "UNKNOWN" ? "Informar fase de vida" : "Ajustar referência"}</Button>
      </div>
      {editing ? <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 md:grid-cols-3">
        <label className="text-sm font-bold">Sexo de referência<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2" onChange={(event) => setSex(event.target.value as DietaryReferenceSex | "")} value={sex}><option value="">Selecione</option><option value="FEMALE">Feminino</option><option value="MALE">Masculino</option></select></label>
        <label className="text-sm font-bold">Fase de vida<select className="mt-1 w-full rounded-lg border bg-white px-3 py-2" onChange={(event) => setLifeStage(event.target.value as DietaryReferenceLifeStage)} value={lifeStage}><option value="UNKNOWN" disabled>Selecione</option><option value="NONE">Sem gestação ou lactação</option><option value="PREGNANCY">Gestação</option><option value="LACTATION">Lactação</option></select></label>
        {needsAdjustmentReason ? <label className="text-sm font-bold">Justificativa profissional<input className="mt-1 w-full rounded-lg border bg-white px-3 py-2" onChange={(event) => setReason(event.target.value)} value={reason} /></label> : <div className="rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-900">Confirmação da fase de vida que estava ausente; sexo e idade do cadastro serão preservados.</div>}
        <div className="md:col-span-3 flex justify-end"><Button disabled={!sex || lifeStage === "UNKNOWN" || (needsAdjustmentReason && !reason.trim()) || calculatedAge === null || calculatedAge < 1 || (lifeStage !== "NONE" && sex !== "FEMALE")} onClick={() => {
          if (!sex || lifeStage === "UNKNOWN" || (needsAdjustmentReason && !reason.trim()) || calculatedAge === null || calculatedAge < 1) return;
          onProfileChange({ ...(profile ?? { ageYears: calculatedAge, ageAt: attendanceDate, birthDate }), sex, lifeStage, origin: confirmsOnlyMissingLifeStage ? "PROFESSIONAL_CONFIRMATION" : "PROFESSIONAL_ADJUSTMENT", adjustmentReason: needsAdjustmentReason ? reason.trim() : undefined, adjustedByUserId: undefined, adjustedAt: undefined });
          setEditing(false); setReason("");
        }} type="button">Aplicar e salvar no plano</Button></div>
        {!profile ? <p className="md:col-span-3 text-xs text-amber-900">A idade será calculada de nascimento e data do atendimento já cadastrados; nenhum perfil padrão será presumido.</p> : null}
      </div> : null}
    </Card>

    {!selectedReferences ? <Card className="border-dashed p-8 text-center"><h2 className="font-black">Adequação aguardando dados do perfil</h2><p className="mt-2 text-sm text-[var(--muted)]">{profile?.lifeStage === "UNKNOWN" ? "Sexo e idade foram identificados. Confirme a fase de vida na data do atendimento para selecionar e congelar as referências." : "Não foi possível identificar sexo ou idade no cadastro e atendimento. Nenhum perfil padrão foi presumido."}</p></Card> : !analysis.prescribedItemCount ? <Card className="border-dashed p-8 text-center"><h2 className="font-black">Plano sem itens prescritos</h2><p className="mt-2 text-sm text-[var(--muted)]">Adicione alimentos ou receitas na Elaboração. Ausência de itens não será exibida como ingestão zero.</p></Card> : <Card className="overflow-hidden p-0">
      <div className="p-4 md:p-5"><h2 className="text-lg font-black">Adequação diária planejada</h2><p className="mt-1 text-sm text-[var(--muted)]">RDA/AI são referências individuais, não metas clínicas. A composição de um plano isolado não diagnostica deficiência.</p></div>
      <div className="grid gap-3 p-4 xl:hidden">{nutrientRows.map(({ reference, total, percent, sourceUnit, guidance }) => {
        const expanded = expandedNutrients.has(reference.nutrient);
        const detailsId = `adequacy-card-details-${reference.nutrient}`;
        return <article className="rounded-xl border border-[var(--line)] p-4" key={reference.nutrient}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h3 className="font-black">{reference.label}</h3><p className="text-xs text-[var(--muted)]">{sourceUnit}</p></div>
          <CoverageDetails total={total} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Planejado</dt><dd className="mt-1 break-words tabular-nums">{total.knownAmount === null ? "Não disponível" : `${preciseNumber.format(total.knownAmount)} ${sourceUnit}`}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Referência</dt><dd className="mt-1"><strong>{reference.referenceType}</strong> {preciseNumber.format(reference.referenceValue)} {reference.unit}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">% da referência</dt><dd className="mt-1 font-black tabular-nums">{percent === null ? "Não determinável" : `${total.coverage === "PARTIAL" ? "≥ " : ""}${number.format(percent)}%`}</dd>{percent !== null && total.knownAmount !== null ? <p className="mt-1 text-xs text-[var(--muted)]">Cálculo: {preciseNumber.format(total.knownAmount)} ÷ {preciseNumber.format(reference.referenceValue)}</p> : null}</div>
          <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Referência superior / abrangência</dt><dd className="mt-1">{upperReferenceLabel(reference)}<span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{reference.note ?? (reference.ulScope === "TOTAL_INTAKE" ? "Ingestão total." : "A abrangência depende da forma/origem.")}</span></dd></div>
        </dl>
        <div className="mt-4 flex flex-col items-start gap-3 text-sm"><p className="font-semibold leading-6">{guidance.summary}</p><Button aria-controls={detailsId} aria-expanded={expanded} onClick={() => toggleNutrient(reference.nutrient)} type="button" variant="secondary">{expanded ? "Ocultar detalhes" : "Ver detalhes"}</Button></div>
        {expanded ? <div className="mt-4 w-full" id={detailsId}><NutrientReviewDetails guidance={guidance} reference={reference} total={total} /></div> : null}
      </article>;
      })}</div>
      <div className="hidden xl:block"><table className="w-full table-fixed text-sm"><colgroup><col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[18%]" /><col className="w-[28%]" /></colgroup><thead className="bg-emerald-950 text-left text-white"><tr><th className="px-3 py-3">Nutriente</th><th className="px-3 py-3">Planejado</th><th className="px-3 py-3">Cobertura</th><th className="px-3 py-3">Referência</th><th className="px-3 py-3">% referência</th><th className="px-3 py-3">Referência superior / abrangência</th><th className="px-3 py-3">Ajuda para revisão</th></tr></thead><tbody className="divide-y divide-[var(--line)]">{nutrientRows.map(({ reference, total, percent, sourceUnit, guidance }) => {
        const expanded = expandedNutrients.has(reference.nutrient);
        const detailsId = `adequacy-table-details-${reference.nutrient}`;
        return <Fragment key={reference.nutrient}><tr className="align-top">
        <th className="break-words px-3 py-3 text-left"><span className="font-black">{reference.label}</span><span className="mt-1 block text-xs font-normal text-[var(--muted)]">{sourceUnit}</span></th>
        <td className="break-words px-3 py-3 tabular-nums">{total.knownAmount === null ? "Não disponível" : `${preciseNumber.format(total.knownAmount)} ${sourceUnit}`}</td>
        <td className="break-words px-3 py-3"><CoverageDetails total={total} /></td>
        <td className="break-words px-3 py-3"><strong>{reference.referenceType}</strong> {preciseNumber.format(reference.referenceValue)} {reference.unit}</td>
        <td className="break-words px-3 py-3 font-black tabular-nums">{percent === null ? "Não determinável" : `${total.coverage === "PARTIAL" ? "≥ " : ""}${number.format(percent)}%`}{percent !== null && total.knownAmount !== null ? <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{preciseNumber.format(total.knownAmount)} ÷ {preciseNumber.format(reference.referenceValue)}</span> : null}</td>
        <td className="break-words px-3 py-3">{upperReferenceLabel(reference)}<span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{reference.note ?? (reference.ulScope === "TOTAL_INTAKE" ? "Ingestão total." : "A abrangência depende da forma/origem.")}</span></td>
        <td className="break-words whitespace-normal px-3 py-3"><p className="font-semibold leading-6">{guidance.summary}</p><Button aria-controls={detailsId} aria-expanded={expanded} className="mt-2" onClick={() => toggleNutrient(reference.nutrient)} type="button" variant="secondary">{expanded ? "Ocultar detalhes" : "Ver detalhes"}</Button></td>
      </tr>{expanded ? <tr><td className="bg-white px-3 py-4" colSpan={7}><div id={detailsId}><NutrientReviewDetails guidance={guidance} reference={reference} total={total} /></div></td></tr> : null}</Fragment>;
      })}</tbody></table></div>
      <div className="border-t bg-[var(--surface)] p-4 text-xs text-[var(--muted)]"><p>* UL não estabelecido não significa ausência de risco.</p><p className="mt-1">Fonte: {DIETARY_REFERENCE_SOURCE.organization}. Particularidades são registradas por nutriente. Não são usados %VD de rótulos.</p><details className="mt-2"><summary className="cursor-pointer font-bold text-[var(--primary)]">Ver fonte e edição por nutriente</summary><ul className="mt-2 columns-1 space-y-1 sm:columns-2">{selectedReferences.map((reference) => <li key={reference.nutrient}><strong>{reference.label}:</strong> {reference.source.edition}</li>)}</ul></details></div>
    </Card>}
  </div>;
}
