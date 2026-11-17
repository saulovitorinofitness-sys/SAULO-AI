import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath =
  "src/components/meal-plan/meal-plan-foundation-workspace.tsx";

test("assistente clinico permite revisar e regenerar uma refeicao sem salvar automaticamente", async () => {
  const [source, route] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
      "utf8",
    ),
  ]);
  for (const label of [
    "Aprovar refei&ccedil;&atilde;o",
    "Regenerar somente esta refei\\u00e7\\u00e3o",
    "Editar manualmente",
    "Justificativa interna. N&atilde;o integra o material do paciente.",
  ]) assert.ok(source.includes(label), label);
  const partial = source.slice(
    source.indexOf("async function regenerateAssistedMeal("),
    source.indexOf("function rejectSmartPreview()"),
  );
  assert.ok(partial.includes('action: "REGENERATE_ASSISTED_MEAL"'));
  assert.ok(partial.includes("meal.id === mealId ? regeneratedMeal : meal"));
  assert.equal(partial.includes("savePlan("), false);
  const post = route.slice(
    route.indexOf("export async function POST("),
    route.indexOf("export async function PUT("),
  );
  assert.ok(post.includes('body.action === "REGENERATE_ASSISTED_MEAL"'));
  assert.ok(post.includes("smartPlanDraftGenerator.regenerateMeal({"));
  assert.ok(post.includes("smartPlanDraftMealToMealPlanMeal("));
  assert.equal(post.includes("mealPlanRepository.save("), false);
});

test("Plano Inteligente e Plano Manual permanecem disponíveis como métodos equivalentes", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.ok(source.includes(">Plano Inteligente</p>"));
  assert.ok(source.includes(">Plano Manual</p>"));
  assert.ok(
    source.includes(
      "Plano Inteligente e Plano Manual são alternativas equivalentes.",
    ),
  );
  assert.ok(source.includes('variant="outline"'));
});

test("nova sugestão confirma antes de substituir um plano preenchido", async () => {
  const source = await readFile(workspacePath, "utf8");
  const request = source.slice(
    source.indexOf("function requestAssistedAssembly()"),
    source.indexOf("async function prepareAssistedAssembly("),
  );

  assert.ok(request.includes("if (hasFoods)"));
  assert.ok(request.includes("setShowIntelligentReplacementConfirmation(true)"));
  assert.ok(
    source.includes(
      "Este plano já possui alimentos. Deseja substituir o conteúdo atual por uma nova prévia inteligente?",
    ),
  );
  assert.ok(source.includes("Substituir conteúdo do plano?"));
  assert.ok(source.includes("Cancelar"));
});

test("troca para edição manual preserva o plano e recomeçar exige confirmação", async () => {
  const source = await readFile(workspacePath, "utf8");
  const manualContinuation = source.slice(
    source.indexOf("function activateManualAssembly()"),
    source.indexOf("function restartManualAssembly()"),
  );
  const manualRestart = source.slice(
    source.indexOf("function restartManualAssembly()"),
    source.indexOf("function requestAssistedAssembly()"),
  );

  assert.equal(manualContinuation.includes("setMeals("), false);
  assert.ok(manualContinuation.includes('setAssemblyMode("MANUAL")'));
  const confirmation = manualRestart.indexOf(
    'confirmFilledPlanReplacement("MANUAL")',
  );
  const replacement = manualRestart.indexOf("setMeals(emptyMeals)");
  assert.ok(confirmation >= 0);
  assert.ok(replacement > confirmation);
});

test("handler inteligente reutiliza geração real sem salvar automaticamente", async () => {
  const route = await readFile(
    "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
    "utf8",
  );
  const post = route.slice(
    route.indexOf("export async function POST("),
    route.indexOf("export async function PUT("),
  );

  assert.ok(post.includes('body?.action !== "GENERATE_ASSISTED_PREVIEW"'));
  assert.ok(post.includes("patientContextService.get("));
  assert.ok(post.includes("nutritionalDecisionEngine.evaluate("));
  assert.ok(post.includes("smartPlanDraftGenerator.generate({"));
  assert.ok(post.includes("smartPlanDraftToMealPlanMeals("));
  assert.ok(post.includes("...generation.smartPlanDraft"));
  assert.equal(post.includes("generateAssistedMealPlanPreview({"), false);
  assert.equal(post.includes("mealPlanRepository.save("), false);
});

test("interface apresenta e persiste a prévia retornada no mesmo rascunho", async () => {
  const source = await readFile(workspacePath, "utf8");
  const generation = source.slice(
    source.indexOf("async function prepareAssistedAssembly("),
    source.indexOf("async function savePlan("),
  );

  assert.ok(generation.includes("setGeneratingPreview(true)"));
  assert.ok(generation.includes("setMeals(previewMeals)"));
  assert.ok(generation.includes("setSmartPreview(result.smartPlanDraft)"));
  assert.ok(generation.includes("setSmartGenerationVersion(result.smartPlanDraft.semanticVersion)"));
  assert.ok(generation.includes('setAiDecision("SUGGESTION_GENERATED")'));
  assert.ok(generation.includes("meals: previewMeals"));
  assert.ok(generation.includes("smartGenerationVersion: result.smartPlanDraft.semanticVersion"));
  assert.ok(generation.includes("await flushAutoSave(previewDraft, previewFingerprint)"));
  assert.ok(source.includes("Gerando Plano Inteligente..."));
  assert.ok(source.includes("generationInFlight.current"));
});

test("prévia do gerador numérico legado fica rejeitada na interface e no backend", async () => {
  const [source, route] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
      "utf8",
    ),
  ]);
  assert.ok(source.includes("Prévia rejeitada por incoerência alimentar"));
  assert.ok(source.includes("!legacyPreviewDismissed"));
  assert.ok(source.includes("(smartGenerationVersion ?? 0) < 2"));
  assert.ok(source.includes(": invalidIntelligentPreview"));
  assert.ok(source.includes("const completionBlocked = Boolean(completionBlockedReason)"));
  assert.ok(source.includes("setLegacyPreviewDismissed(true)"));
  assert.ok(route.includes('draft.status === "APPROVED"'));
  assert.ok(route.includes('draft.aiDecision !== "IDLE"'));
  assert.ok(route.includes("(draft.smartGenerationVersion ?? 0) < 2"));
  assert.ok(route.includes("Esta prévia foi rejeitada por incoerência alimentar"));
});

test("pendências são apresentadas sem apagar o plano atual", async () => {
  const source = await readFile(workspacePath, "utf8");
  const generation = source.slice(
    source.indexOf("async function prepareAssistedAssembly("),
    source.indexOf("function rejectSmartPreview()"),
  );
  const failure = generation.indexOf("setGenerationPending(result?.pending ?? [])");
  const replacement = generation.indexOf("setMeals(previewMeals)");
  assert.ok(failure >= 0);
  assert.ok(replacement > failure);
  assert.ok(source.includes("Origem esperada: {issue.expectedSource}"));
  assert.ok(source.includes("Motivo: {issue.reason}"));
});

test("interface separa impedimentos clínicos de dados opcionais e permite gerar sem recordatório", async () => {
  const [source, route] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
      "utf8",
    ),
  ]);
  assert.ok(source.includes("Impedimentos clínicos"));
  assert.ok(source.includes("Dados opcionais não informados"));
  assert.ok(source.includes("Gerar proposta inicial sem recordatório"));
  assert.ok(source.includes("Completar dados para maior personalização"));
  assert.ok(source.includes('prepareAssistedAssembly("GENERATE_INITIAL_WITHOUT_RECALL")'));
  assert.ok(route.includes('body?.action !== "GENERATE_INITIAL_WITHOUT_RECALL"'));
  assert.ok(route.includes('body.action === "GENERATE_INITIAL_WITHOUT_RECALL"'));
  assert.ok(route.includes('habitualIntakeBasis: "NOT_INFORMED" as const'));
});

test("prévia expõe identificação, alertas e quatro controles locais", async () => {
  const source = await readFile(workspacePath, "utf8");
  assert.ok(source.includes("Prévia gerada pelo Plano Inteligente — aguardando validação do nutricionista."));
  assert.ok(source.includes("Requer ajuste profissional."));
  assert.ok(source.includes("Aprovar prévia"));
  assert.ok(source.includes("Rejeitar prévia"));
  assert.ok(source.includes("Gerar nova prévia"));
  assert.ok(source.includes("Continuar editando manualmente"));
});

test("aprovação aguarda persistência e falha permite nova tentativa", async () => {
  const source = await readFile(workspacePath, "utf8");
  const controls = source.slice(
    source.indexOf("{hasFoods && assemblyMode"),
    source.indexOf('<Card className="space-y-4 p-4">', source.indexOf("{hasFoods && assemblyMode")),
  );
  const rejection = source.slice(
    source.indexOf("function rejectSmartPreview()"),
    source.indexOf("async function savePlan("),
  );
  assert.ok(controls.includes('setAiDecision("APPROVED")'));
  assert.ok(controls.includes("!smartPreviewPersisted"));
  assert.ok(controls.includes("Aguardando salvamento"));
  assert.ok(controls.includes('autoSaveState === "ERROR"'));
  assert.ok(controls.includes("Tentar salvar novamente"));
  assert.ok(controls.includes("retrySmartPreviewSave()"));
  assert.equal(controls.includes("savePlan("), false);
  assert.ok(rejection.includes("previewBaselineMeals.current"));
  assert.ok(rejection.includes("setMeals(restored)"));
  assert.ok(rejection.includes('setAiDecision("IDLE")'));
});

test("continuar manualmente mantém os alimentos gerados", async () => {
  const source = await readFile(workspacePath, "utf8");
  const manualContinuation = source.slice(
    source.indexOf("function activateManualAssembly()"),
    source.indexOf("function restartManualAssembly()"),
  );
  assert.equal(manualContinuation.includes("setMeals("), false);
  assert.ok(manualContinuation.includes('setAssemblyMode("MANUAL")'));
});

test("Plano Manual, Histórico, Entregáveis e navegação permanecem disponíveis", async () => {
  const [workspace, page, navigation, flow] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile("src/app/(authenticated)/pacientes/[patientId]/plano-alimentar/page.tsx", "utf8"),
    readFile("src/components/nutrition-clinical-flow/clinical-flow-navigation.tsx", "utf8"),
    readFile("src/features/nutrition-clinical-flow/flow.ts", "utf8"),
  ]);
  assert.ok(workspace.includes(">Plano Manual</p>"));
  assert.ok(workspace.includes("<PrescriptionHistory"));
  assert.ok(page.includes("<ClinicalFlowNavigation"));
  assert.ok(navigation.includes("flow.find("));
  assert.ok(flow.includes('title: "Entregáveis"'));
});

test("substituição V2 expõe contexto, comparação percentual e confirmação", async () => {
  const source = await readFile(workspacePath, "utf8");
  for (const label of [
    "Alimento atual",
    "Grupo alimentar",
    "Fonte nutricional",
    "Medida utilizada",
    "Quantidade",
    "Peso",
    "Macros",
    "Diferença absoluta",
    "Diferença percentual",
    "Motivo da sugestão · uso interno",
    "Quantidade da alternativa",
    "Medida caseira da alternativa",
    "Quantidade total da alternativa",
    "Confirmar substituição",
  ]) assert.ok(source.includes(label), label);

  const selection = source.slice(
    source.indexOf("async function chooseFood("),
    source.indexOf("function confirmFoodSubstitution()"),
  );
  assert.ok(selection.includes("setPendingSubstitution"));
  assert.equal(selection.includes("foodSubstitutionService.replace"), false);
  const confirmation = source.slice(
    source.indexOf("function confirmFoodSubstitution()"),
    source.indexOf("function duplicateFood("),
  );
  assert.ok(confirmation.includes("foodSubstitutionService.attach"));
  assert.ok(confirmation.includes("responsibleUser"));
  assert.ok(confirmation.includes("suggestionReason"));
  assert.ok(source.includes("updateFoodSubstitutionPortion"));
});

test("operações mutáveis compartilham persistência automática e rejeição cancela pendência", async () => {
  const source = await readFile(workspacePath, "utf8");
  const operations = source.slice(
    source.indexOf("function updateMeal("),
    source.indexOf("function confirmFilledPlanReplacement("),
  );
  for (const handler of [
    "function updateMeal(",
    "function addMeal(",
    "function removeMeal(",
    "function moveMeal(",
    "function duplicateFood(",
    "function removeFood(",
  ]) {
    const start = operations.indexOf(handler);
    const next = operations.indexOf("\n  function ", start + handler.length);
    const body = operations.slice(start, next < 0 ? undefined : next);
    assert.ok(body.includes("scheduleAutoSave("), handler);
  }
  const rejection = source.slice(
    source.indexOf("function rejectSmartPreview()"),
    source.indexOf("async function savePlan("),
  );
  assert.ok(rejection.includes("discardPendingAutoSave()"));
});

test("pesquisas abortadas não sobrescrevem estado e falha de rede libera salvamento", async () => {
  const source = await readFile(workspacePath, "utf8");
  assert.ok(
    (source.match(/controller\.signal\.aborted/g)?.length ?? 0) >= 4,
  );
  const saveStart = source.indexOf("async function savePlan(");
  const save = source.slice(
    saveStart,
    source.indexOf("\n  return (", saveStart),
  );
  assert.ok(save.includes(".catch(() => null)"));
  assert.ok(save.includes("if (!response)"));
  assert.ok(save.includes("setSaving(false)"));
});

test("salvamento automático e manual usam o mesmo payload persistível e preservam o rascunho na falha", async () => {
  const [source, route] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
      "utf8",
    ),
  ]);
  const saveStart = source.indexOf("async function savePlan(");
  const flushStart = source.indexOf("async function flushAutoSave(", saveStart);
  const save = source.slice(saveStart, flushStart);
  const failureHandling = save.slice(0, save.indexOf("setPlan((current)"));
  const submit = source.slice(
    source.indexOf("onSubmit={(event) =>"),
    source.indexOf("<div", source.indexOf("onSubmit={(event) =>")),
  );
  const flush = source.slice(
    flushStart,
    source.indexOf("autoSaveRunner.current", flushStart),
  );
  const retry = source.slice(
    source.indexOf("async function retrySmartPreviewSave()"),
    source.indexOf("function recoverLocalDraft()"),
  );

  assert.ok(save.includes("meals: draftToSave.meals.map"));
  assert.equal(save.includes("smartPreview"), false);
  assert.ok(submit.includes("void savePlan("));
  assert.ok(flush.includes("savePlan(false, draftToSave, true)"));
  assert.equal(failureHandling.includes("removeLocalDraft("), false);
  assert.ok(retry.includes("currentDraft.current"));
  assert.ok(route.includes("diagnoseMealPlanDraftFoodCanonicalization("));
  assert.ok(route.includes("{ status: 409 }"));
  assert.equal(route.includes("message: issues"), false);
});

test("construção inicial usa os dados disponíveis sem exigir opcionais", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.ok(source.includes(
    "Será criada uma proposta inicial usando os dados disponíveis.",
  ));
  assert.equal(source.includes(
    "somente poderá gerar uma sugestão inicial quando horários e dados clínicos obrigatórios estiverem completos",
  ), false);
});

test("manual e inteligente permitem decisão explícita para desvios sem afrouxar a tolerância", async () => {
  const [source, route, repository] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
      "utf8",
    ),
    readFile("src/features/meal-plan/repository.ts", "utf8"),
  ]);

  assert.ok(source.includes("nutritionTargetsInvalid"));
  assert.ok(source.includes("Voltar e ajustar o plano"));
  assert.ok(source.includes("Manter os valores e continuar"));
  assert.ok(source.includes("authorizeCurrentTargetDeviations"));
  assert.equal(source.includes("!smartPreviewPersisted || nutritionTargetsInvalid"), false);
  assert.ok(repository.includes('throw new Error("MEAL_PLAN_TARGET_DEVIATION_AUTHORIZATION_REQUIRED")'));
  assert.ok(repository.includes("planRevision: revision"));
  assert.ok(route.includes('error.message === "MEAL_PLAN_TARGET_DEVIATION_AUTHORIZATION_REQUIRED"'));
  assert.ok(route.includes("authorizedByUserId: access.user.id"));
  assert.ok(route.includes("targetDeviationAuthorizationMatches({"));
});

test("conclusão fica bloqueada enquanto houver refeição pendente ou prévia não aprovada", async () => {
  const [source, route, repository] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
      "utf8",
    ),
    readFile("src/features/meal-plan/repository.ts", "utf8"),
  ]);

  assert.ok(source.includes("pendingMealReviewCount"));
  assert.ok(source.includes("intelligentPreviewNotApproved"));
  assert.ok(source.includes("const completionBlocked = Boolean(completionBlockedReason)"));
  assert.ok(source.includes("if (complete && completionBlockedReason)"));
  assert.ok(repository.includes('throw new Error("MEAL_PLAN_PREVIEW_NOT_APPROVED")'));
  assert.ok(route.includes('error.message === "MEAL_PLAN_PREVIEW_NOT_APPROVED"'));
});

test("ações superior e inferior compartilham bloqueio e motivo de conclusão", async () => {
  const [workspace, navigation] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/components/nutrition-clinical-flow/clinical-flow-navigation.tsx",
      "utf8",
    ),
  ]);

  assert.ok(workspace.includes("useClinicalFlowPrimaryActionState({"));
  assert.ok(workspace.includes("disabled: completionBlocked"));
  assert.ok(workspace.includes("blockedReason: completionBlockedReason"));
  assert.ok(navigation.includes("primaryActionState?.disabled"));
  assert.ok(navigation.includes("primaryActionState?.blockedReason"));
  assert.ok(navigation.includes("clinical-flow-primary-action-blocked-reason"));
  assert.ok(workspace.includes("targetDeviationAuthorizationValid"));
  assert.ok(workspace.includes("targetDeviationAuthorization,"));
});

test("nutrição parcial exige revisão explícita sem ser promovida a completa", async () => {
  const [workspace, route, repository] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(
      "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
      "utf8",
    ),
    readFile("src/features/meal-plan/repository.ts", "utf8"),
  ]);

  assert.ok(workspace.includes("hasPartialNutrition"));
  assert.ok(workspace.includes("limitações composicionais a reconhecer"));
  assert.ok(workspace.includes("Valores conhecidos · total parcial"));
  assert.ok(repository.includes("review: input.draft.professionalReview"));
  assert.ok(route.includes("acknowledgedLimitations: eligibility.limitations"));
  assert.equal(repository.includes('throw new Error("MEAL_PLAN_RECIPE_NUTRITION_INCOMPLETE")'), false);
  assert.equal(route.includes('error.message === "MEAL_PLAN_RECIPE_NUTRITION_INCOMPLETE"'), false);
});

test("peso da porção só é canonicalizado com rendimento final equivalente", async () => {
  const route = await readFile(
    "src/app/api/patients/[patientId]/attendances/[attendanceId]/meal-plan/route.ts",
    "utf8",
  );

  assert.ok(route.includes("function validatedServingSize("));
  assert.ok(route.includes("snapshot.finalYieldAmount"));
  assert.ok(route.includes("servingSize * recipeServings - finalYieldAmount"));
  assert.ok(route.includes("formatRecipePortionDescription("));
});

test("resumo nutricional empilha título, status e valor sem transbordamento", async () => {
  const source = await readFile(workspacePath, "utf8");
  const start = source.indexOf('title="Resumo nutricional"');
  const end = source.indexOf("</Card>", start);
  const summary = source.slice(start, end);

  assert.ok(summary.includes("grid-cols-1 auto-rows-fr"));
  assert.ok(summary.includes("sm:grid-cols-2"));
  assert.ok(summary.includes("lg:grid-cols-3"));
  assert.ok(summary.includes("xl:grid-cols-5"));
  assert.ok(summary.includes("min-h-32 min-w-0 flex-col"));
  assert.ok(summary.includes("break-words text-xs font-black uppercase"));
  assert.ok(summary.includes("inline-flex max-w-full rounded-full"));
  assert.ok(summary.includes("mt-auto break-words pt-3"));
  assert.ok(summary.includes('"ADEQUATE"'));
  assert.ok(summary.includes('"NEAR_TARGET"'));
  assert.equal(summary.includes("overflow-x"), false);
  assert.equal(summary.includes("flex items-center justify-between"), false);
});

test("edição de quantidade e peso permanece editável e agenda salvamento", async () => {
  const source = await readFile(workspacePath, "utf8");
  const start = source.indexOf("function updateFoodPortion(");
  const end = source.indexOf("function selectIbgeMeasure(", start);
  const portionUpdate = source.slice(start, end);
  const rowStart = source.indexOf('aria-label={`Medida de ${food.description}`}');
  const rowEnd = source.indexOf("{[food.nutrients.energyKcal", rowStart);
  const inputs = source.slice(rowStart, rowEnd);

  assert.ok(portionUpdate.includes("scheduleAutoSave(nextMeals)"));
  assert.equal(inputs.includes("disabled={!food.selectedIbgeMeasureId}"), false);
  assert.equal(inputs.includes("readOnly={Boolean(food.selectedIbgeMeasureId)}"), false);
  assert.ok(inputs.includes('field: "quantity"'));
  assert.ok(inputs.includes('field: "grams"'));
});
