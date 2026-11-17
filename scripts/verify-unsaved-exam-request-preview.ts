import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { SESSION_COOKIE_NAME } from "../src/features/mvp/session-authentication";
import { prisma } from "../src/lib/database/prisma";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const patient = await prisma.patient.findFirst({
  where: { clinicalCode: "SV000006", status: "ACTIVE", deletedAt: null },
  select: { id: true, clinicalCode: true },
});
if (!patient) throw new Error("Pessoa SV000006 não encontrada.");

const exams = [
  "Hemograma completo",
  "Glicemia de jejum",
  "Hemoglobina glicada",
  "Colesterol total",
  "Colesterol HDL",
  "Colesterol LDL",
  "Triglicerídeos",
  "Creatinina",
  "Hormônio estimulante da tireoide",
] as const;

const root = process.cwd();
const temporaryRoot = path.resolve(root, "tmp/pdfs/unsaved-exam-request-preview");
const profile = path.join(temporaryRoot, "chrome-profile");
const screenshot = path.join(temporaryRoot, "notebook-1366x768-actions.png");
const output = path.resolve(root, "output/pdf/previa-solicitacao-nova-nove-exames-nao-salva.pdf");
await rm(temporaryRoot, { recursive: true, force: true });
await mkdir(profile, { recursive: true });
await mkdir(path.dirname(output), { recursive: true });

const before = await prisma.deliverable.findMany({
  where: { kind: "EXAM_REQUEST", deletedAt: null },
  orderBy: { id: "asc" },
  select: { id: true, version: true, status: true, updatedAt: true, metadata: true },
});
const beforeHash = createHash("sha256").update(JSON.stringify(before)).digest("hex");

const rawToken = randomBytes(32).toString("hex");
const session = await prisma.authSession.create({
  data: {
    userId: BUILT_IN_IDS.users.sauloXavierVitorino,
    tokenHash: createHash("sha256").update(rawToken, "utf8").digest("hex"),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  },
  select: { id: true },
});

const port = 9334;
const baseUrl = "http://localhost:3000";
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new",
  "--disable-gpu",
  "--disable-gpu-sandbox",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--no-first-run",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1366,768",
  "about:blank",
], { stdio: "ignore" });

type Pending = { resolve: (value: unknown) => void; reject: (reason: unknown) => void; timeout: ReturnType<typeof setTimeout> };
const pending = new Map<number, Pending>();
let sequence = 0;

try {
  let browserTarget: { webSocketDebuggerUrl?: string } | undefined;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      browserTarget = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()) as { webSocketDebuggerUrl?: string };
      if (browserTarget.webSocketDebuggerUrl) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!browserTarget?.webSocketDebuggerUrl) throw new Error("Chrome DevTools não ficou disponível.");

  const socket = new WebSocket(browserTarget.webSocketDebuggerUrl);
  socket.binaryType = "arraybuffer";
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("Falha ao conectar ao Chrome.")), { once: true });
  });
  socket.addEventListener("message", async (event) => {
    const raw = typeof event.data === "string"
      ? event.data
      : event.data instanceof ArrayBuffer
        ? Buffer.from(event.data).toString("utf8")
        : event.data instanceof Blob
          ? await event.data.text()
          : String(event.data);
    const message = JSON.parse(raw) as { id?: number; result?: unknown; error?: unknown };
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  });

  const send = <T>(method: string, params: Record<string, unknown> = {}, sessionId?: string) => new Promise<T>((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome não respondeu a ${method}.`));
    }, 15_000);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const targets = await send<{ targetInfos: { targetId: string; type: string }[] }>("Target.getTargets");
  const pageTarget = targets.targetInfos.find((item) => item.type === "page");
  if (!pageTarget) throw new Error("Alvo de página não encontrado.");
  const attached = await send<{ sessionId: string }>("Target.attachToTarget", { targetId: pageTarget.targetId, flatten: true });
  const pageSend = <T>(method: string, params: Record<string, unknown> = {}) => send<T>(method, params, attached.sessionId);
  const evaluate = async <T>(expression: string) => {
    const result = await pageSend<{ result?: { value?: T }; exceptionDetails?: unknown }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`Falha na interface: ${JSON.stringify(result.exceptionDetails)}`);
    return result.result?.value;
  };
  const waitFor = async (expression: string, label: string) => {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      if (await evaluate<boolean>(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Tempo esgotado ao aguardar ${label}.`);
  };

  await send("Storage.setCookies", { cookies: [{ name: SESSION_COOKIE_NAME, value: rawToken, url: baseUrl, httpOnly: true, sameSite: "Lax" }] });
  await pageSend("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await pageSend("Page.navigate", { url: `${baseUrl}/entregaveis/solicitacoes-exames?patientId=${encodeURIComponent(patient.id)}` });
  await waitFor("document.readyState === 'complete' && document.body.innerText.includes('Nova solicitação')", "editor");
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Nova solicitação');
    button?.click();
    return Boolean(button);
  })()`);

  for (const exam of exams) {
    const encoded = JSON.stringify(exam);
    await evaluate(`(() => {
      const input = [...document.querySelectorAll('input')].find((item) => item.offsetParent !== null && item.placeholder?.includes('sinônimo'));
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${encoded});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await waitFor(`[...document.querySelectorAll('li')].some((item) => item.offsetParent !== null && item.textContent?.includes(${encoded}) && item.textContent?.includes('+ Adicionar'))`, `catálogo: ${exam}`);
    const added = await evaluate<boolean>(`(() => {
      const card = [...document.querySelectorAll('li')].find((item) => item.offsetParent !== null && item.textContent?.includes(${encoded}) && item.textContent?.includes('+ Adicionar'));
      const button = card?.querySelector('button');
      button?.click();
      return Boolean(button);
    })()`);
    if (!added) throw new Error(`Não foi possível adicionar ${exam}.`);
  }

  await waitFor("document.querySelector('[aria-labelledby=requested-exams-title] ol')?.children.length === 9", "nove exames no editor");
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Visualizar prévia');
    button?.scrollIntoView({ block: 'center' });
    return Boolean(button);
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const actions = await evaluate<Record<string, boolean>>(`(() => Object.fromEntries(['Visualizar prévia', 'Imprimir / Salvar PDF', 'Salvar rascunho', 'Revisar para emitir'].map((label) => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
    const rect = button?.getBoundingClientRect();
    return [label, Boolean(button && rect && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth)];
  })))()` ) ?? {};
  if (Object.values(actions).some((visible) => !visible) || Object.keys(actions).length !== 4) throw new Error(`Ações ausentes em 1366 × 768: ${JSON.stringify(actions)}`);

  const captured = await pageSend<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(screenshot, Buffer.from(captured.data, "base64"));

  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Visualizar prévia');
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor("Boolean(document.querySelector('[role=dialog]')) && document.querySelector('[role=dialog]')?.innerText.includes('RASCUNHO')", "prévia transitória");
  const previewText = await evaluate<string>("document.querySelector('[role=dialog]')?.innerText ?? ''") ?? "";
  for (const exam of exams) if (!previewText.includes(exam)) throw new Error(`Exame ausente da prévia: ${exam}`);
  if (!previewText.includes("Saulo Xavier Vitorino") || !previewText.includes("CRN 11 — 22529/P-CE") || !previewText.includes("Fundamentação:")) throw new Error("Documento transitório incompleto.");
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu.test(previewText)) throw new Error("UUID visível na prévia.");

  const printed = await pageSend<{ data: string }>("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  await writeFile(output, Buffer.from(printed.data, "base64"));
  socket.close();

  const after = await prisma.deliverable.findMany({
    where: { kind: "EXAM_REQUEST", deletedAt: null },
    orderBy: { id: "asc" },
    select: { id: true, version: true, status: true, updatedAt: true, metadata: true },
  });
  const afterHash = createHash("sha256").update(JSON.stringify(after)).digest("hex");
  if (afterHash !== beforeHash) throw new Error("A prévia transitória alterou solicitações persistidas.");

  console.log(JSON.stringify({
    patientCode: patient.clinicalCode,
    unsavedExamCount: exams.length,
    actionsVisibleAt1366x768: actions,
    databaseUnchanged: true,
    screenshot,
    output,
  }, null, 2));
} finally {
  chrome.kill();
  await new Promise<void>((resolve) => {
    if (chrome.exitCode !== null) return resolve();
    chrome.once("exit", () => resolve());
    setTimeout(resolve, 2_000);
  });
  await prisma.authSession.deleteMany({ where: { id: session.id } });
  try { await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {}
}
