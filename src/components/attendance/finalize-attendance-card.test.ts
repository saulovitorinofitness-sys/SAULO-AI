import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

type Element = { type: unknown; props: Record<string, unknown> };
type FetchCall = { url: string; options: RequestInit };

function childrenOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(childrenOf);
  if (value && typeof value === "object" && "props" in value) {
    return childrenOf((value as Element).props.children);
  }
  return value === undefined || value === null ? [] : [value];
}

function findButton(tree: unknown, label: string): Element | undefined {
  if (Array.isArray(tree)) {
    return tree.map((child) => findButton(child, label)).find(Boolean);
  }
  if (!tree || typeof tree !== "object" || !("props" in tree)) return undefined;
  const element = tree as Element;
  const text = childrenOf(element.props.children).join("");
  if ((element.type === "button" || element.type === "Button") && text === label) {
    return element;
  }
  return findButton(element.props.children, label);
}

function textOf(tree: unknown) {
  return childrenOf(tree).join(" ");
}

function click(element: Element | undefined) {
  assert.ok(element);
  const handler = element.props.onClick;
  assert.equal(typeof handler, "function");
  (handler as () => void)();
}

async function createHarness(
  fetchImpl: (url: string, options: RequestInit) => Promise<unknown> = async () => ({
    ok: true,
    json: async () => ({}),
  }),
) {
  const source = await readFile(new URL("./finalize-attendance-card.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const hooks: unknown[] = [];
  const calls: FetchCall[] = [];
  const replacements: string[] = [];
  let cursor = 0;
  const react = {
    useState<T>(initial: T): [T, (next: T) => void] {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index] as T, (next) => { hooks[index] = next; }];
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect() { cursor++; },
  };
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
  const compiledModule = { exports: {} as { FinalizeAttendanceCard?: (props: { patientId: string; patientName: string; attendanceId: string }) => Element } };
  runInNewContext(compiled, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(id: string) {
      if (id === "react") return react;
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id === "next/navigation") return { useRouter: () => ({ replace: (url: string) => replacements.push(url) }) };
      if (id === "@/features/development-session") return { developmentUserRequestHeaders: () => ({}) };
      if (id === "@/components/ui") return { Button: "Button", ButtonLink: "ButtonLink", buttonStyles: () => "button" };
      throw new Error(`Unexpected import: ${id}`);
    },
    fetch(url: string, options: RequestInit) {
      calls.push({ url, options });
      return fetchImpl(url, options);
    },
  });
  assert.ok(compiledModule.exports.FinalizeAttendanceCard);
  return {
    calls,
    replacements,
    render() {
      cursor = 0;
      return compiledModule.exports.FinalizeAttendanceCard!({ patientId: "patient-1", patientName: "Maria Gilvania", attendanceId: "attendance-1" });
    },
  };
}

test("abrir e atualizar a página não envia POST", async () => {
  const harness = await createHarness();
  assert.ok(findButton(harness.render(), "Finalizar consulta"));
  assert.ok(findButton(harness.render(), "Finalizar consulta"));
  assert.equal(harness.calls.length, 0);
});

test("primeiro clique só abre confirmação e cancelar não envia POST", async () => {
  const harness = await createHarness();
  click(findButton(harness.render(), "Finalizar consulta"));
  const confirmation = harness.render();
  assert.match(textOf(confirmation), /Confirmar finalização do atendimento/);
  assert.match(textOf(confirmation), /Este atendimento será encerrado/);
  assert.equal(harness.calls.length, 0);
  click(findButton(confirmation, "Cancelar"));
  assert.ok(findButton(harness.render(), "Finalizar consulta"));
  assert.equal(harness.calls.length, 0);
});

test("somente confirmar envia um POST e clique duplo não duplica", async () => {
  let resolveRequest: ((value: unknown) => void) | undefined;
  const harness = await createHarness(() => new Promise((resolve) => { resolveRequest = resolve; }));
  click(findButton(harness.render(), "Finalizar consulta"));
  const confirm = findButton(harness.render(), "Finalizar consulta");
  assert.ok(confirm);
  click(confirm);
  click(confirm);
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0].url, "/api/patients/patient-1/attendances/attendance-1/finalize");
  assert.equal(harness.calls[0].options.method, "POST");
  assert.match(textOf(harness.render()), /Finalizando atendimento/);
  resolveRequest?.({ ok: true, json: async () => ({}) });
  await new Promise(setImmediate);
  assert.deepEqual(harness.replacements, ["/atendimentos"]);
  assert.equal(harness.calls.length, 1);
});

test("erro da API é exibido e não limpa a URL", async () => {
  const harness = await createHarness(async () => ({
    ok: false,
    json: async () => ({ message: "Atendimento indisponível para finalização." }),
  }));
  click(findButton(harness.render(), "Finalizar consulta"));
  click(findButton(harness.render(), "Finalizar consulta"));
  await new Promise(setImmediate);
  assert.match(textOf(harness.render()), /Atendimento indisponível para finalização/);
  assert.deepEqual(harness.replacements, []);
});

test("página concluída mostra estado final e o GET não chama mutação", async () => {
  const page = await readFile(new URL("../../app/(authenticated)/atendimentos/page.tsx", import.meta.url), "utf8");
  assert.match(page, /attendanceForFinalization\?\.status === "COMPLETED"/);
  assert.match(page, /title="Atendimento finalizado"/);
  assert.match(page, /attendanceForFinalization\?\.status === "IN_PROGRESS"/);
  assert.ok(
    page.indexOf('attendanceForFinalization?.status === "COMPLETED"') <
      page.indexOf("<FinalizeAttendanceCard"),
  );
  assert.doesNotMatch(page, /finalizeAttendance\(|method: "POST"|\bfetch\(/);
});

test("modal informa etapas pendentes e justificativa para atendimento vazio", async () => {
  const source = await readFile(new URL("./finalize-attendance-card.tsx", import.meta.url), "utf8");
  assert.match(source, /Estas etapas permanecerão pendentes/);
  assert.match(source, /obrigatória sem registro clínico/);
  assert.match(source, /closureObservation/);
  assert.match(source, /role="dialog"/);
});

test("modal identifica claramente a paciente e o atendimento antes da finalização", async () => {
  const harness = await createHarness();
  click(findButton(harness.render(), "Finalizar consulta"));
  const confirmation = textOf(harness.render());

  assert.match(confirmation, /Maria Gilvania/);
  assert.match(confirmation, /Identificador do atendimento/);
  assert.match(confirmation, /attendance-1/);
  assert.match(confirmation, /Início/);
});
