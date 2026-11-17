import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { SESSION_COOKIE_NAME } from "../src/features/mvp/session-authentication";
import { prisma } from "../src/lib/database/prisma";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const [draftId, patientId] = process.argv.slice(2);
if (!draftId || !patientId) throw new Error("Uso: verify-exam-request-usability <draftId> <patientId>");

const root = process.cwd();
const temporaryRoot = path.resolve(root, "tmp/pdfs/exam-request-usability");
const profile = path.join(temporaryRoot, "chrome-profile");
const desktopScreenshot = path.join(temporaryRoot, "notebook-1366x768.png");
const mobileScreenshot = path.join(temporaryRoot, "mobile-390x844.png");
await rm(temporaryRoot, { recursive: true, force: true });
await mkdir(profile, { recursive: true });

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const before = await prisma.deliverable.findMany({
  where: { kind: "EXAM_REQUEST", deletedAt: null },
  select: { id: true, version: true, status: true, updatedAt: true, metadata: true },
});
const previous = new Map(before.filter((item) => item.id !== draftId).map((item) => [item.id, fingerprint(item)]));

const rawToken = randomBytes(32).toString("hex");
const session = await prisma.authSession.create({
  data: {
    userId: BUILT_IN_IDS.users.sauloXavierVitorino,
    tokenHash: createHash("sha256").update(rawToken, "utf8").digest("hex"),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  },
  select: { id: true },
});

const port = 9333;
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
    if (result.exceptionDetails) throw new Error(`Falha ao avaliar a interface: ${JSON.stringify(result.exceptionDetails)}`);
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
  await pageSend("Page.navigate", { url: `${baseUrl}/entregaveis/solicitacoes-exames?patientId=${encodeURIComponent(patientId)}` });
  await waitFor("document.readyState === 'complete' && document.body.innerText.includes('Catálogo de exames')", "carregamento da tela");

  const selectedDraft = await evaluate<boolean>(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('TESTE — SEM VALIDADE CLÍNICA'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!selectedDraft) throw new Error("Rascunho de teste não apareceu no histórico.");
  await waitFor("document.body.innerText.includes('Hemograma completo') && document.body.innerText.includes('Creatinina')", "reabertura do rascunho");

  await evaluate(`(() => {
    const input = [...document.querySelectorAll('input')].find((item) => item.placeholder?.includes('sinônimo'));
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'TSH');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await waitFor("document.body.innerText.includes('Hormônio estimulante da tireoide')", "busca por sinônimo");
  const added = await evaluate<boolean>(`(() => {
    const card = [...document.querySelectorAll('li')].find((item) => item.textContent?.includes('Hormônio estimulante da tireoide') && item.textContent?.includes('+ Adicionar'));
    const button = card?.querySelector('button');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!added) throw new Error("Botão + Adicionar não ficou disponível.");
  await waitFor("[...document.querySelectorAll('li')].some((item) => item.textContent?.includes('Hormônio estimulante da tireoide') && item.textContent?.includes('Adicionado'))", "estado Adicionado");

  const saved = await evaluate<boolean>(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Salvar rascunho');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!saved) throw new Error("Ação Salvar rascunho não encontrada.");
  await waitFor("document.body.innerText.includes('Rascunho salvo.') || Boolean(document.querySelector('[role=alert]'))", "resposta do salvamento do rascunho");
  const saveResult = await evaluate<{ saved: boolean; alert?: string }>(`(() => ({
    saved: document.body.innerText.includes('Rascunho salvo.'),
    alert: document.querySelector('[role=alert]')?.textContent?.trim(),
  }))()`);
  if (!saveResult?.saved) throw new Error(`Falha ao salvar pelo editor: ${saveResult?.alert ?? "sem mensagem"}`);

  await pageSend("Page.reload", { ignoreCache: true });
  await waitFor("document.readyState === 'complete' && document.body.innerText.includes('Histórico')", "reabertura da página");
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('TESTE — SEM VALIDADE CLÍNICA'));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor("document.body.innerText.includes('Hormônio estimulante da tireoide') && document.body.innerText.includes('Visualizar prévia')", "conteúdo reaberto");

  const desktop = await pageSend<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(desktopScreenshot, Buffer.from(desktop.data, "base64"));

  await pageSend("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`(() => {
    const details = [...document.querySelectorAll('details')].find((item) => item.textContent?.includes('Abrir catálogo de exames'));
    if (!details) return false;
    details.open = true;
    details.scrollIntoView({ block: 'start' });
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const mobile = await pageSend<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(mobileScreenshot, Buffer.from(mobile.data, "base64"));
  socket.close();

  const reopened = await prisma.deliverable.findUnique({
    where: { id: draftId },
    select: { status: true, version: true, updatedAt: true, metadata: true },
  });
  const metadata = reopened?.metadata as { content?: { requestedExams?: unknown; justification?: unknown } } | null;
  if (!reopened || reopened.status !== "DRAFT") throw new Error("A prévia emitiu ou removeu o rascunho.");
  if (!Array.isArray(metadata?.content?.requestedExams) || metadata.content.requestedExams.length !== 5) throw new Error("O rascunho não preservou os cinco exames.");
  if (metadata.content.justification !== "TESTE — SEM VALIDADE CLÍNICA") throw new Error("Identificação do teste não foi preservada.");

  const afterPrevious = await prisma.deliverable.findMany({
    where: { id: { in: [...previous.keys()] } },
    select: { id: true, version: true, status: true, updatedAt: true, metadata: true },
  });
  for (const item of afterPrevious) {
    if (fingerprint(item) !== previous.get(item.id)) throw new Error(`Solicitação anterior alterada: ${item.id}`);
  }

  console.log(JSON.stringify({
    draftId,
    status: reopened.status,
    examCount: metadata.content.requestedExams.length,
    savedAndReopened: true,
    previousRequestsUnchanged: afterPrevious.length,
    screenshots: { desktopScreenshot, mobileScreenshot },
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
