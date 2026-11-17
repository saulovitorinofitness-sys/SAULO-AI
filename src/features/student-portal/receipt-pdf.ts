interface StudentReceiptPdfInput {
  readonly id: string;
  readonly number: number | null;
  readonly provider: string;
  readonly studentName: string;
  readonly studentCode: string;
  readonly receivedAmount: string;
  readonly paidAt: string;
  readonly services: readonly {
    readonly description: string;
    readonly serviceDate: string;
    readonly grossAmount: string;
  }[];
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

function pdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/gu, "-")
    .replace(/([\\()])/gu, "\\$1");
}

function splitLine(value: string, limit = 72) {
  const words = value.trim().split(/\s+/u);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= limit) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function text(x: number, y: number, size: number, value: string, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`;
}

function pageContent(receipt: StudentReceiptPdfInput, services: StudentReceiptPdfInput["services"], page: number, totalPages: number) {
  const commands = [
    "0.09 0.25 0.21 rg 0 734 595 108 re f",
    "1 1 1 rg",
    text(42, 801, 10, "CLÍNICA SV · RECIBO", true),
    text(42, 773, 20, receipt.provider, true),
    text(42, 751, 10, receipt.number ? `Recibo nº ${receipt.number}` : `Recibo ${receipt.id}`),
    "0.10 0.19 0.16 rg",
    text(42, 704, 9, "ALUNO", true),
    text(42, 686, 12, receipt.studentName, true),
    text(315, 704, 9, "CADASTRO", true),
    text(315, 686, 12, receipt.studentCode, true),
    text(42, 651, 9, "VALOR RECEBIDO", true),
    text(42, 632, 14, money.format(Number(receipt.receivedAmount)), true),
    text(315, 651, 9, "DATA DO PAGAMENTO", true),
    text(315, 632, 12, date.format(new Date(receipt.paidAt)), true),
    "0.80 0.84 0.82 RG 42 608 m 553 608 l S",
    text(42, 583, 11, "SERVIÇOS", true),
  ];

  let y = 553;
  for (const service of services) {
    const descriptionLines = splitLine(service.description, 58).slice(0, 2);
    commands.push(text(42, y, 10, descriptionLines[0], true));
    if (descriptionLines[1]) commands.push(text(42, y - 14, 9, descriptionLines[1]));
    commands.push(text(390, y, 10, money.format(Number(service.grossAmount)), true));
    commands.push(text(42, y - (descriptionLines[1] ? 30 : 17), 8, date.format(new Date(service.serviceDate))));
    y -= descriptionLines[1] ? 61 : 48;
    commands.push(`0.89 0.91 0.90 RG 42 ${y + 18} m 553 ${y + 18} l S`);
  }

  commands.push(text(42, 56, 8, "Documento disponível exclusivamente no Portal do Aluno autenticado."));
  commands.push(text(485, 56, 8, `${page}/${totalPages}`));
  return commands.join("\n");
}

function object(id: number, body: string | Buffer) {
  const header = Buffer.from(`${id} 0 obj\n`, "latin1");
  const content = typeof body === "string" ? Buffer.from(body, "latin1") : body;
  return Buffer.concat([header, content, Buffer.from("\nendobj\n", "latin1")]);
}

export function createStudentReceiptPdf(receipt: StudentReceiptPdfInput) {
  const groups: StudentReceiptPdfInput["services"][] = [];
  for (let index = 0; index < Math.max(receipt.services.length, 1); index += 8) {
    groups.push(receipt.services.slice(index, index + 8));
  }

  const pageIds = groups.map((_, index) => 5 + index * 2);
  const objects: Buffer[] = [
    object(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    object(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`),
    object(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    object(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
  ];

  groups.forEach((services, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = Buffer.from(pageContent(receipt, services, index + 1, groups.length), "latin1");
    objects.push(object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`));
    objects.push(object(contentId, Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
      stream,
      Buffer.from("\nendstream", "latin1"),
    ])));
  });

  const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1");
  const offsets = [0];
  let offset = header.length;
  for (const item of objects) {
    offsets.push(offset);
    offset += item.length;
  }
  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");
  return Buffer.concat([header, ...objects, Buffer.from(xref, "latin1")]);
}
