import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/database/prisma";
import { BUILT_IN_IDS } from "../src/modules/permissions";
import { SESSION_COOKIE_NAME } from "../src/features/mvp/session-authentication";

const [requestId, patientId, requestedFileName = "solicitacao-exames-teste-simulado.pdf", renderMode = "issued"] = process.argv.slice(2);
const preview = renderMode === "preview";
if (!requestId || !patientId || !/^[a-z0-9-]+\.pdf$/u.test(requestedFileName) || !["issued", "preview"].includes(renderMode)) throw new Error("Uso: render-exam-request-pdf <requestId> <patientId> [arquivo.pdf] [issued|preview]");

const root = process.cwd();
const output = path.resolve(root, "output/pdf", requestedFileName);
const profile = path.resolve(root, "tmp/pdfs/exam-request-chrome-profile");
if (!profile.startsWith(path.resolve(root, "tmp/pdfs") + path.sep)) throw new Error("Perfil temporário fora da pasta permitida.");
await rm(profile, { recursive: true, force: true });
await mkdir(profile, { recursive: true });
await mkdir(path.dirname(output), { recursive: true });

const before = await prisma.deliverable.findUnique({
  where: { id: requestId },
  select: { version: true, updatedAt: true, status: true },
});
if (!before || (preview ? before.status !== "DRAFT" : before.status !== "PUBLISHED")) throw new Error(preview ? "Rascunho não encontrado." : "Solicitação emitida não encontrada.");

const rawToken = randomBytes(32).toString("hex");
const session = await prisma.authSession.create({
  data: {
    userId: BUILT_IN_IDS.users.sauloXavierVitorino,
    tokenHash: createHash("sha256").update(rawToken, "utf8").digest("hex"),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  },
  select: { id: true },
});

const port = 9331;
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
  "about:blank",
], { stdio: "ignore" });

type Pending = { resolve: (value: unknown) => void; reject: (reason: unknown) => void; timeout: ReturnType<typeof setTimeout> };
const pending = new Map<number, Pending>();
let sequence = 0;

try {
  let target: { webSocketDebuggerUrl?: string } | undefined;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      target = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()) as { webSocketDebuggerUrl?: string };
      if (target?.webSocketDebuggerUrl) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!target?.webSocketDebuggerUrl) throw new Error("Chrome DevTools não ficou disponível.");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
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
  socket.addEventListener("close", () => {
    for (const [id, request] of pending) {
      clearTimeout(request.timeout);
      request.reject(new Error(`Chrome fechou a conexão com a chamada ${id} pendente.`));
    }
    pending.clear();
  });

  const send = <T>(method: string, params: Record<string, unknown> = {}, sessionId?: string) => new Promise<T>((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome não respondeu a ${method} em 10 segundos.`));
    }, 10_000);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const targets = await send<{ targetInfos: { targetId: string; type: string }[] }>("Target.getTargets");
  const pageTarget = targets.targetInfos.find((item) => item.type === "page");
  if (!pageTarget) throw new Error("Alvo de página do Chrome não encontrado.");
  const attached = await send<{ sessionId: string }>("Target.attachToTarget", { targetId: pageTarget.targetId, flatten: true });
  const pageSend = <T>(method: string, params: Record<string, unknown> = {}) => send<T>(method, params, attached.sessionId);

  await send("Storage.setCookies", { cookies: [{ name: SESSION_COOKIE_NAME, value: rawToken, url: baseUrl, httpOnly: true, sameSite: "Lax" }] });
  const url = `${baseUrl}/entregaveis/solicitacoes-exames/${encodeURIComponent(requestId)}/imprimir?patientId=${encodeURIComponent(patientId)}${preview ? "&preview=1" : ""}`;
  await pageSend("Page.navigate", { url });

  let pageText = "";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const state = await pageSend<{ result?: { value?: string } }>("Runtime.evaluate", {
      expression: "document.readyState + '\\n' + document.body.innerText",
      returnByValue: true,
    });
    pageText = state.result?.value ?? "";
    if (pageText.startsWith("complete\n") && pageText.includes("Solicitação de exames") && pageText.includes("Exames solicitados")) break;
  }
  const testMarker = preview ? "TESTE — SEM VALIDADE CLÍNICA" : "TESTE — dados simulados";
  if (!pageText.includes(testMarker)) throw new Error("Conteúdo simulado não apareceu no documento.");
  if (!pageText.includes("Maria gilvania dos Santos") || !pageText.includes("Saulo Xavier Vitorino")) throw new Error("Identificações do documento estão incompletas.");
  if (!pageText.includes("CRN 11 — 22529/P-CE") || !pageText.includes("Fundamentação:")) throw new Error("Carimbo profissional ou fundamentação ausentes.");
  if (pageText.includes("CPF")) throw new Error("CPF não deve aparecer na nova impressão.");
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu.test(pageText)) throw new Error("UUID visível no documento.");

  const printed = await pageSend<{ data: string }>("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
  });
  await writeFile(output, Buffer.from(printed.data, "base64"));
  socket.close();

  const after = await prisma.deliverable.findUnique({
    where: { id: requestId },
    select: { version: true, updatedAt: true, status: true },
  });
  if (!after || after.version !== before.version || after.updatedAt.getTime() !== before.updatedAt.getTime() || after.status !== before.status) {
    throw new Error("A impressão alterou o registro persistido.");
  }
  console.log(JSON.stringify({ output, pageText, persistenceUnchanged: true, version: after.version }, null, 2));
} finally {
  chrome.kill();
  await new Promise<void>((resolve) => {
    if (chrome.exitCode !== null) return resolve();
    chrome.once("exit", () => resolve());
    setTimeout(resolve, 2_000);
  });
  await prisma.authSession.deleteMany({ where: { id: session.id } });
  try {
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    // O perfil fica restrito a tmp/pdfs e pode ser removido na próxima execução.
  }
}
