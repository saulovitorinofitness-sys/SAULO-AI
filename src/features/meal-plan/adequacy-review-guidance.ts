import type { DietaryReferenceValue } from "./dietary-reference";
import type { PlannedNutrientTotal } from "./plan-nutrition-analysis";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function contributorLabel(item: PlannedNutrientTotal["contributors"][number]) {
  return `${item.itemName} (${item.mealName})`;
}

function joinedItems(items: readonly PlannedNutrientTotal["contributors"][number][]) {
  return items.map(contributorLabel).join("; ");
}

function principalSuppliers(total: PlannedNutrientTotal) {
  return total.contributors
    .filter((item) => item.knownAmount !== null && item.knownAmount > 0)
    .slice(0, 3);
}

function referenceName(reference: DietaryReferenceValue) {
  if (reference.referenceType === "RDA") return "RDA (recomendação para ingestão usual individual)";
  if (reference.referenceType === "AI") return "AI (ingestão adequada estimada quando não há RDA)";
  return "CDRR (referência para redução de risco de doença crônica)";
}

function requiredFormName(reference: DietaryReferenceValue) {
  if (reference.referenceRequiredForm === "DFE") return "equivalentes de folato dietético (DFE)";
  if (reference.referenceRequiredForm === "RAE") return "equivalentes de atividade de retinol (RAE)";
  return null;
}

function comparisonUnavailableReason(
  reference: DietaryReferenceValue,
  total: PlannedNutrientTotal,
  sourceUnit: string,
) {
  const requiredForm = requiredFormName(reference);
  if (!requiredForm) return `A unidade ${sourceUnit} não é comparável à unidade da referência.`;
  if (total.nutrientForm === "MIXED") {
    return `O subtotal combina formas nutricionais diferentes. Para comparar com a ${reference.referenceType}, é necessário separar as contribuições e documentar valores compatíveis em ${requiredForm}.`;
  }
  if (!total.nutrientForm || total.nutrientForm === "UNSPECIFIED") {
    return `A fonte ou o snapshot não identifica a forma nutricional. Para comparar com a ${reference.referenceType}, é necessário documentar o valor em ${requiredForm} ou uma conversão válida.`;
  }
  return `O plano informa ${sourceUnit}, enquanto a ${reference.referenceType} exige ${requiredForm}. A comparação depende de uma conversão documentada que não está disponível.`;
}

function upperReferenceResult(
  reference: DietaryReferenceValue,
  total: PlannedNutrientTotal,
) {
  if (!reference.ul || reference.ulComparison === "NOT_ESTABLISHED") {
    return "Não há UL estabelecido para esta comparação; isso não demonstra ausência de risco em ingestões elevadas.";
  }
  if (reference.ulComparison === "NOT_DETERMINABLE") {
    if (reference.ulRequiredForm === "FOLIC_ACID") {
      return "O UL considera ácido fólico sintético de suplementos e alimentos fortificados. O plano não separa com segurança essa origem, portanto a comparação com o UL não é determinável.";
    }
    if (reference.ulRequiredForm === "RETINOL") {
      return "O UL considera vitamina A pré-formada. O plano não separa com segurança essa forma, portanto a comparação com o UL não é determinável.";
    }
    return "A forma, a origem ou a abrangência necessária para comparar com a referência superior não está distinguida nos dados.";
  }
  if (total.knownAmount === null) return "Não há quantidade conhecida para comparar com a referência superior.";
  const above = total.knownAmount > reference.ul;
  const upperType = reference.upperType ?? "UL";
  if (upperType === "CDRR") {
    if (above) return total.coverage === "PARTIAL"
      ? "O subtotal conhecido já está acima da CDRR. A CDRR não é limite de toxicidade; indica a faixa acima da qual a redução da ingestão é esperada reduzir risco crônico."
      : "A quantidade planejada está acima da CDRR. A CDRR não é limite de toxicidade; orienta a avaliação de redução de risco crônico.";
    return total.coverage === "PARTIAL"
      ? "O subtotal conhecido não ultrapassa a CDRR, mas os dados faltantes podem alterar essa comparação."
      : "A quantidade planejada não ultrapassa a CDRR.";
  }
  if (above) return total.coverage === "PARTIAL"
    ? "O subtotal conhecido já ultrapassa o UL comparável; o total real pode ser maior. Isso sinaliza potencial risco e requer avaliação profissional."
    : "A quantidade planejada ultrapassa o UL comparável, o que sinaliza potencial risco de efeitos adversos; o UL não é uma meta de ingestão.";
  return total.coverage === "PARTIAL"
    ? "O subtotal conhecido não ultrapassa o UL, mas os dados faltantes impedem concluir sobre o total."
    : "A quantidade planejada não ultrapassa o UL comparável.";
}

export interface NutrientReviewGuidance {
  readonly summary: string;
  readonly comparison: readonly string[];
  readonly possibleAdjustment: readonly string[];
}

export function buildNutrientReviewGuidance(input: {
  readonly reference: DietaryReferenceValue;
  readonly total: PlannedNutrientTotal;
  readonly referenceComparable: boolean;
  readonly sourceUnit: string;
}): NutrientReviewGuidance {
  const { reference, total, referenceComparable, sourceUnit } = input;
  const planned = total.knownAmount === null
    ? "sem quantidade conhecida"
    : `${number.format(total.knownAmount)} ${sourceUnit}`;
  const referenceValue = `${number.format(reference.referenceValue)} ${reference.unit}`;
  const comparison = [
    `O plano fornece ${planned}. A referência selecionada é ${referenceName(reference)} de ${referenceValue}.`,
  ];

  if (total.coverage === "ABSENT") {
    const absentItems = total.contributors.filter((item) => item.knownAmount === null);
    comparison.push("Todos os itens ativos estão sem informação para este nutriente. Ausência de dado não significa ingestão zero.");
    comparison.push(upperReferenceResult(reference, total));
    return {
      summary: "Comparação indisponível: não há composição conhecida no plano.",
      comparison,
      possibleAdjustment: [`Conferir a composição ou o snapshot de: ${joinedItems(absentItems)}. Esses itens estão efetivamente sem informação para o nutriente.`],
    };
  }

  if (!referenceComparable) {
    const reason = comparisonUnavailableReason(reference, total, sourceUnit);
    comparison.push(reason, upperReferenceResult(reference, total));
    return {
      summary: `Comparação com a ${reference.referenceType} não determinável: forma ou unidade incompatível.`,
      comparison,
      possibleAdjustment: [
        `Conferir na fonte e no snapshot se o nutriente está documentado em ${requiredFormName(reference) ?? reference.unit}; se houver conversão, registrar sua base antes de recalcular.`,
        "Não aumentar nem reduzir quantidades com base nesta comparação até que a forma nutricional compatível esteja documentada.",
      ],
    };
  }

  const atOrAbove = total.knownAmount! >= reference.referenceValue;
  if (total.coverage === "PARTIAL") {
    const partialRecipes = total.contributors.filter((item) => item.itemType === "RECIPE" && item.coverage === "PARTIAL");
    const absentItems = total.contributors.filter((item) => item.knownAmount === null);
    const missingConversions = total.contributors.filter((item) => item.quantityCompatibility === "MISSING_CONVERSION");
    const unknownBases = total.contributors.filter((item) => item.quantityCompatibility === "UNKNOWN");
    comparison.push(`${planned} é um subtotal conhecido: ${total.partialItemCount} item(ns) têm composição parcial e ${total.absentItemCount} estão sem informação.`);
    if (atOrAbove) {
      comparison.push(`O subtotal já ${reference.referenceType === "AI" ? "atinge" : "alcança"} a ${reference.referenceType}; o total completo pode ser maior. Isso não indica automaticamente excesso prejudicial.`);
    } else if (reference.referenceType === "AI") {
      comparison.push("O subtotal está abaixo da AI, mas ingestão abaixo da AI não permite concluir inadequação — especialmente com dados faltantes.");
    } else {
      comparison.push(`O subtotal está abaixo da ${reference.referenceType}; com dados faltantes, não é possível concluir que o total planejado esteja abaixo dela.`);
    }
    comparison.push(upperReferenceResult(reference, total));
    const upperExceeded = Boolean(
      reference.ul &&
      reference.ulComparison === "APPLICABLE" &&
      total.knownAmount! > reference.ul,
    );
    return {
      summary: upperExceeded
        ? `O subtotal conhecido já ultrapassa a ${reference.upperType ?? "UL"}; o total permanece parcial.`
        : atOrAbove
        ? `O subtotal conhecido já alcança ${percent.format((total.knownAmount! / reference.referenceValue) * 100)}% da ${reference.referenceType}; o total permanece parcial.`
        : `Há apenas um subtotal conhecido de ${percent.format((total.knownAmount! / reference.referenceValue) * 100)}% da ${reference.referenceType}; não é possível classificar o total.`,
      comparison,
      possibleAdjustment: [
        ...(partialRecipes.length ? [`Receitas com subtotal parcial: ${joinedItems(partialRecipes)}. O snapshot não identifica um ingrediente responsável; é necessário conferir a composição registrada da receita.`] : []),
        ...(absentItems.length ? [`Itens sem informação: ${joinedItems(absentItems)}.`] : []),
        ...(missingConversions.length ? [`Conversão de unidade ausente em: ${joinedItems(missingConversions)}. A prescrição e a base nutricional usam unidades diferentes.`] : []),
        ...(unknownBases.length ? [`Unidade da base nutricional não identificada em: ${joinedItems(unknownBases)}.`] : []),
        ...(principalSuppliers(total).length ? [`Principais fornecedores ativos para revisar, se necessário: ${joinedItems(principalSuppliers(total))}. As quantidades e evidências estão na seção de contribuintes acima.`] : []),
      ],
    };
  }

  if (reference.referenceType === "AI") {
    comparison.push(atOrAbove
      ? "A quantidade planejada atinge a AI, situação compatível com baixa probabilidade de inadequação da ingestão usual. Acima da AI não significa excesso prejudicial."
      : "A quantidade planejada está abaixo da AI. Esse resultado não permite classificar a ingestão como inadequada.");
  } else if (reference.referenceType === "RDA") {
    comparison.push(atOrAbove
      ? "A quantidade planejada atinge a RDA, referência para ingestão usual individual. Acima da RDA não significa excesso prejudicial."
      : "A quantidade planejada está abaixo da RDA. Isso orienta a revisão do plano, mas não diagnostica deficiência nem descreve resultado de exame.");
  } else {
    comparison.push(atOrAbove
      ? "A quantidade planejada está na ou acima da CDRR; essa referência trata de redução de risco crônico, não de deficiência ou toxicidade."
      : "A quantidade planejada está abaixo da CDRR; essa referência trata de redução de risco crônico, não de deficiência ou toxicidade.");
  }
  comparison.push(upperReferenceResult(reference, total));

  const upperExceeded = Boolean(
    reference.ul &&
    reference.ulComparison === "APPLICABLE" &&
    total.knownAmount! > reference.ul,
  );
  const suppliers = principalSuppliers(total);
  const supplierNames = suppliers.length
    ? joinedItems(suppliers)
    : "nenhum fornecedor com contribuição positiva conhecida";
  return {
    summary: upperExceeded
      ? `A quantidade planejada ultrapassa a ${reference.upperType ?? "UL"} comparável; requer revisão profissional.`
      : atOrAbove
      ? `${percent.format((total.knownAmount! / reference.referenceValue) * 100)}% da ${reference.referenceType}; isso não representa automaticamente excesso.`
      : `${percent.format((total.knownAmount! / reference.referenceValue) * 100)}% da ${reference.referenceType}; isso não é diagnóstico de deficiência.`,
    comparison,
    possibleAdjustment: upperExceeded
      ? [`Revisar a abrangência da referência superior e os principais fornecedores ativos: ${supplierNames}. As quantidades estão na seção de contribuintes acima.`]
      : reference.referenceType === "AI" && !atOrAbove
        ? ["Confirmar se o plano representa a ingestão usual e considerar os demais dados da avaliação; ficar abaixo da AI, isoladamente, não justifica aumentar quantidades."]
        : atOrAbove
          ? [`Não reduzir alimentos apenas por ultrapassar RDA/AI. Principais fornecedores ativos: ${supplierNames}; revisar quantidades somente se houver objetivo clínico ou outra evidência aplicável.`]
          : [`Se clinicamente pertinente, avaliar os principais fornecedores ativos: ${supplierNames}. A seção acima mostra as quantidades prescritas; nenhuma mudança é executada aqui.`],
  };
}
