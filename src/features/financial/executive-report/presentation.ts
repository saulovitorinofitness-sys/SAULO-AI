import pptxgen from "pptxgenjs";

import type { FinancialEntryView } from "../contracts";
import type { FinancialExecutiveReportView } from "./contracts";

const PptxGenJS = (
  pptxgen as unknown as { readonly default?: typeof pptxgen }
).default ?? pptxgen;
const SHAPE = new PptxGenJS().ShapeType;

const COLORS = {
  canvas: "FFFEFB",
  green: "17644C",
  greenDark: "173C30",
  greenSoft: "EDF6F1",
  gold: "A17D2E",
  goldSoft: "FFF9E9",
  red: "8B3A46",
  redSoft: "FFF3F4",
  slate: "40564E",
  muted: "718079",
  line: "D8E4DC",
  white: "FFFFFF",
} as const;

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const emissionFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type Presentation = InstanceType<typeof PptxGenJS>;
type Slide = ReturnType<Presentation["addSlide"]>;

function money(value: string) {
  return moneyFormatter.format(Number(value));
}

function date(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function emission(value: string) {
  return emissionFormatter.format(new Date(value));
}

function addInstitutionalHeader(slide: Slide, title: string, kicker: string) {
  slide.addShape(SHAPE.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.78,
    fill: { color: COLORS.canvas },
    line: { color: COLORS.canvas },
  });
  slide.addShape(SHAPE.roundRect, {
    x: 0.55,
    y: 0.17,
    w: 0.48,
    h: 0.43,
    rectRadius: 0.06,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
  slide.addText("SV", {
    x: 0.55,
    y: 0.25,
    w: 0.48,
    h: 0.16,
    align: "center",
    bold: true,
    color: "E2C675",
    fontFace: "Aptos",
    fontSize: 10,
    margin: 0,
  });
  slide.addText("CENTRO DE GESTÃO SV", {
    x: 1.16,
    y: 0.16,
    w: 2.7,
    h: 0.2,
    bold: true,
    color: COLORS.greenDark,
    fontFace: "Aptos Display",
    fontSize: 11,
    margin: 0,
  });
  slide.addText("SISTEMA INTEGRADO SV", {
    x: 1.16,
    y: 0.41,
    w: 2.7,
    h: 0.13,
    bold: true,
    charSpacing: 1.4,
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 6.5,
    margin: 0,
  });
  slide.addText(kicker.toUpperCase(), {
    x: 4.35,
    y: 0.18,
    w: 2.2,
    h: 0.15,
    align: "right",
    bold: true,
    charSpacing: 1.2,
    color: COLORS.gold,
    fontFace: "Aptos",
    fontSize: 7,
    margin: 0,
  });
  slide.addText(title, {
    x: 6.75,
    y: 0.15,
    w: 6.02,
    h: 0.32,
    align: "right",
    bold: true,
    color: COLORS.greenDark,
    fontFace: "Aptos Display",
    fontSize: 20,
    margin: 0,
    fit: "shrink",
  });
  slide.addShape(SHAPE.line, {
    x: 0.55,
    y: 0.76,
    w: 12.23,
    h: 0,
    line: { color: COLORS.green, width: 1.5 },
  });
}

function addFooter(slide: Slide, page: number) {
  slide.addShape(SHAPE.line, {
    x: 0.55,
    y: 7.12,
    w: 12.23,
    h: 0,
    line: { color: COLORS.line, width: 0.8 },
  });
  slide.addText("Centro de Gestão SV · Sistema Integrado SV", {
    x: 0.55,
    y: 7.2,
    w: 4.2,
    h: 0.12,
    bold: true,
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 7,
    margin: 0,
  });
  slide.addText(String(page), {
    x: 12.2,
    y: 7.2,
    w: 0.58,
    h: 0.12,
    align: "right",
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 7,
    margin: 0,
  });
}

function addMetricCard(slide: Slide, input: {
  x: number;
  y: number;
  w: number;
  label: string;
  value: string;
  tone?: "positive" | "negative" | "warning" | "neutral";
}) {
  const tone = input.tone ?? "neutral";
  const palette = {
    positive: { fill: COLORS.greenSoft, line: "C9DDD3", text: COLORS.greenDark },
    negative: { fill: COLORS.redSoft, line: "EFD1D6", text: COLORS.red },
    warning: { fill: COLORS.goldSoft, line: "EADFBD", text: "6B531D" },
    neutral: { fill: "F7FAF8", line: COLORS.line, text: "243B33" },
  }[tone];
  slide.addShape(SHAPE.roundRect, {
    x: input.x,
    y: input.y,
    w: input.w,
    h: 1.18,
    rectRadius: 0.06,
    fill: { color: palette.fill },
    line: { color: palette.line, width: 1 },
  });
  slide.addText(input.label.toUpperCase(), {
    x: input.x + 0.18,
    y: input.y + 0.2,
    w: input.w - 0.36,
    h: 0.2,
    bold: true,
    charSpacing: 0.8,
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 8,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(money(input.value), {
    x: input.x + 0.18,
    y: input.y + 0.55,
    w: input.w - 0.36,
    h: 0.35,
    bold: true,
    color: palette.text,
    fontFace: "Aptos Display",
    fontSize: 22,
    margin: 0,
    fit: "shrink",
  });
}

function addSectionLabel(slide: Slide, text: string, x: number, y: number, w: number) {
  slide.addText(text.toUpperCase(), {
    x,
    y,
    w,
    h: 0.2,
    bold: true,
    charSpacing: 1.1,
    color: COLORS.gold,
    fontFace: "Aptos",
    fontSize: 8,
    margin: 0,
  });
}

function addEmptyState(slide: Slide, text: string, x: number, y: number, w: number, h: number) {
  slide.addShape(SHAPE.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    fill: { color: "F7FAF8", transparency: 20 },
    line: { color: COLORS.line, dashType: "dash" },
  });
  slide.addText(text, {
    x: x + 0.2,
    y: y + h / 2 - 0.12,
    w: w - 0.4,
    h: 0.24,
    align: "center",
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 13,
    margin: 0,
  });
}

function agendaValues(view: FinancialExecutiveReportView, kind: "PAYABLE" | "RECEIVABLE") {
  if (kind === "PAYABLE") {
    return [
      ["Vencidas", view.payables.totals.overdue],
      ["Vencem hoje", view.payables.totals.today],
      ["Próximos 7 dias", view.payables.totals.next7Days],
      ["Próximos 30 dias", view.payables.totals.next30Days],
    ] as const;
  }
  return [
    ["Vencidas", view.receivables.buckets.overdue.amount],
    ["Vencem hoje", view.receivables.buckets.today.amount],
    ["Próximos 7 dias", view.receivables.buckets.next7Days.amount],
    ["Próximos 30 dias", view.receivables.buckets.next30Days.amount],
  ] as const;
}

function addAgendaColumn(slide: Slide, input: {
  x: number;
  title: string;
  values: readonly (readonly [string, string])[];
  entries: readonly FinancialEntryView[];
  emptyMessage: string;
}) {
  slide.addText(input.title, {
    x: input.x,
    y: 1.08,
    w: 5.85,
    h: 0.32,
    bold: true,
    color: COLORS.greenDark,
    fontFace: "Aptos Display",
    fontSize: 22,
    margin: 0,
  });
  input.values.forEach(([label, value], index) => {
    const x = input.x + (index % 2) * 2.97;
    const y = 1.55 + Math.floor(index / 2) * 0.82;
    slide.addShape(SHAPE.roundRect, {
      x,
      y,
      w: 2.82,
      h: 0.68,
      rectRadius: 0.04,
      fill: { color: "F7FAF8" },
      line: { color: COLORS.line },
    });
    slide.addText(label.toUpperCase(), {
      x: x + 0.14,
      y: y + 0.1,
      w: 1.4,
      h: 0.15,
      bold: true,
      color: COLORS.muted,
      fontFace: "Aptos",
      fontSize: 6.8,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(money(value), {
      x: x + 0.14,
      y: y + 0.32,
      w: 2.5,
      h: 0.22,
      bold: true,
      color: COLORS.greenDark,
      fontFace: "Aptos Display",
      fontSize: 15,
      margin: 0,
      fit: "shrink",
    });
  });

  addSectionLabel(slide, "Principais pendências", input.x, 3.28, 5.85);
  if (!input.entries.length) {
    addEmptyState(slide, input.emptyMessage, input.x, 3.62, 5.85, 2.7);
    return;
  }

  const entries = input.entries.slice(0, 4);
  entries.forEach((entry, index) => {
    const y = 3.62 + index * 0.66;
    slide.addShape(SHAPE.roundRect, {
      x: input.x,
      y,
      w: 5.85,
      h: 0.55,
      rectRadius: 0.03,
      fill: { color: index % 2 === 0 ? COLORS.white : "F7FAF8" },
      line: { color: COLORS.line, width: 0.6 },
    });
    slide.addText(date(entry.dueDate), {
      x: input.x + 0.12,
      y: y + 0.17,
      w: 0.82,
      h: 0.16,
      bold: true,
      color: COLORS.slate,
      fontFace: "Aptos",
      fontSize: 8,
      margin: 0,
    });
    slide.addText(entry.description, {
      x: input.x + 1.02,
      y: y + 0.13,
      w: 3.15,
      h: 0.24,
      bold: true,
      color: "243B33",
      fontFace: "Aptos",
      fontSize: 10,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(money(entry.remainingAmount), {
      x: input.x + 4.28,
      y: y + 0.15,
      w: 1.42,
      h: 0.2,
      align: "right",
      bold: true,
      color: COLORS.greenDark,
      fontFace: "Aptos",
      fontSize: 10,
      margin: 0,
      fit: "shrink",
    });
  });
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function financialExecutivePresentationFileName(view: FinancialExecutiveReportView) {
  const unit = sanitizeFilePart(view.unit.name) || view.unit.code;
  const period = `${view.period.start}-a-${view.period.end}`;
  return `Relatorio-Executivo-Financeiro-${unit}-${period}.pptx`;
}

export function createFinancialExecutivePresentation(view: FinancialExecutiveReportView) {
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "Centro de Gestão SV";
  presentation.company = "Sistema Integrado SV";
  presentation.subject = `Relatório Executivo Financeiro — ${view.unit.name}`;
  presentation.title = "Relatório Executivo Financeiro";
  presentation.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  const cover = presentation.addSlide();
  cover.background = { color: COLORS.canvas };
  cover.addShape(SHAPE.rect, {
    x: 0,
    y: 0,
    w: 4.25,
    h: 7.5,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
  cover.addShape(SHAPE.line, {
    x: 4.25,
    y: 0,
    w: 0,
    h: 7.5,
    line: { color: "E2C675", width: 4 },
  });
  cover.addShape(SHAPE.roundRect, {
    x: 0.72,
    y: 0.7,
    w: 0.82,
    h: 0.72,
    rectRadius: 0.07,
    fill: { color: "13533F" },
    line: { color: "E2C675", width: 1 },
  });
  cover.addText("SV", {
    x: 0.72,
    y: 0.93,
    w: 0.82,
    h: 0.2,
    align: "center",
    bold: true,
    color: "E2C675",
    fontFace: "Aptos",
    fontSize: 18,
    margin: 0,
  });
  cover.addText("CENTRO DE GESTÃO SV", {
    x: 0.72,
    y: 1.72,
    w: 2.95,
    h: 0.35,
    bold: true,
    color: COLORS.white,
    fontFace: "Aptos Display",
    fontSize: 20,
    margin: 0,
  });
  cover.addText("SISTEMA INTEGRADO SV", {
    x: 0.72,
    y: 2.18,
    w: 2.95,
    h: 0.22,
    bold: true,
    charSpacing: 2.2,
    color: "D7E5DF",
    fontFace: "Aptos",
    fontSize: 9,
    margin: 0,
  });
  cover.addText("ENTREGÁVEL\nPROFISSIONAL", {
    x: 0.72,
    y: 5.68,
    w: 2.7,
    h: 0.65,
    bold: true,
    breakLine: false,
    charSpacing: 1.8,
    color: "E2C675",
    fontFace: "Aptos",
    fontSize: 11,
    margin: 0,
  });
  cover.addText("Relatório\nExecutivo Financeiro", {
    x: 5.08,
    y: 1.25,
    w: 7.25,
    h: 1.55,
    bold: true,
    breakLine: false,
    color: COLORS.greenDark,
    fontFace: "Aptos Display",
    fontSize: 34,
    margin: 0,
    fit: "shrink",
  });
  cover.addShape(SHAPE.line, {
    x: 5.08,
    y: 3.08,
    w: 6.9,
    h: 0,
    line: { color: COLORS.gold, width: 1.5 },
  });
  const coverDetails = [
    ["UNIDADE", view.unit.name],
    ["PERÍODO ANALISADO", view.period.label],
    ["DATA DE EMISSÃO", emission(view.issuedAt)],
  ] as const;
  coverDetails.forEach(([label, value], index) => {
    const y = 3.55 + index * 0.82;
    cover.addText(label, {
      x: 5.08,
      y,
      w: 2.15,
      h: 0.17,
      bold: true,
      charSpacing: 1.1,
      color: COLORS.gold,
      fontFace: "Aptos",
      fontSize: 8,
      margin: 0,
    });
    cover.addText(value, {
      x: 7.4,
      y: y - 0.03,
      w: 4.95,
      h: 0.28,
      bold: true,
      color: COLORS.slate,
      fontFace: "Aptos",
      fontSize: 16,
      margin: 0,
      fit: "shrink",
    });
  });

  const summary = presentation.addSlide();
  summary.background = { color: COLORS.canvas };
  addInstitutionalHeader(summary, "Resumo executivo", "Movimentação realizada — Caixa");
  type SummaryMetric = readonly [
    string,
    string,
    "positive" | "negative" | "warning" | "neutral"
  ];
  const resultTone: SummaryMetric[2] = Number(view.summary.realizedBalance) >= 0
    ? "positive"
    : "negative";
  const ownerWithdrawalMetrics: readonly SummaryMetric[] =
    view.unit.code === "ACADEMIA" || view.unit.code === "ALL"
      ? [["Retiradas do proprietário", view.summary.ownerWithdrawalPaid, "neutral"]]
      : [];
  const metrics: readonly SummaryMetric[] = [
    ["Receitas realizadas", view.summary.totalReceived, "positive"],
    ["Despesas realizadas", view.summary.totalPaid, "negative"],
    ["Resultado realizado", view.summary.realizedBalance, resultTone],
    ["A receber", view.summary.openReceivable, "neutral"],
    ["A pagar", view.summary.openPayable, "warning"],
    ["Vencidos", view.summary.overdueTotal, "warning"],
    ...ownerWithdrawalMetrics,
    ["Total disponível", view.summary.totalAvailable, "positive"],
  ];
  metrics.forEach(([label, value, tone], index) => {
    addMetricCard(summary, {
      x: 0.65 + (index % 4) * 3.05,
      y: 1.2 + Math.floor(index / 4) * 1.55,
      w: 2.82,
      label,
      value,
      tone,
    });
  });
  summary.addText("Os indicadores reproduzem os valores consolidados no Relatório Executivo Financeiro para a unidade e o período selecionados.", {
    x: 0.68,
    y: 4.65,
    w: 11.95,
    h: 0.55,
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 15,
    margin: 0,
  });
  addFooter(summary, 2);

  const balances = presentation.addSlide();
  balances.background = { color: COLORS.canvas };
  addInstitutionalHeader(balances, "Saldos por conta", "Saldo realizado no SAULO-AI");
  balances.addText("Movimentações registradas ou importadas; não representa conciliação bancária oficial.", {
    x: 0.65,
    y: 1.12,
    w: 12.03,
    h: 0.28,
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 13,
    margin: 0,
  });
  if (!view.summary.accountBalances.length) {
    addEmptyState(balances, "Sem dados de saldo por conta no período", 0.65, 1.75, 12.03, 3.8);
  } else {
    const cards = view.summary.accountBalances;
    const columns = cards.length <= 4 ? 2 : 3;
    const cardWidth = columns === 2 ? 5.85 : 3.84;
    cards.forEach((account, index) => {
      const x = 0.65 + (index % columns) * (cardWidth + 0.17);
      const y = 1.68 + Math.floor(index / columns) * 1.05;
      balances.addShape(SHAPE.roundRect, {
        x,
        y,
        w: cardWidth,
        h: 0.86,
        rectRadius: 0.05,
        fill: { color: "F7FAF8" },
        line: { color: COLORS.line },
      });
      balances.addText(account.financialAccount.name, {
        x: x + 0.18,
        y: y + 0.17,
        w: cardWidth * 0.56,
        h: 0.23,
        bold: true,
        color: COLORS.slate,
        fontFace: "Aptos",
        fontSize: 14,
        margin: 0,
        fit: "shrink",
      });
      balances.addText(money(account.realizedBalance), {
        x: x + cardWidth * 0.58,
        y: y + 0.15,
        w: cardWidth * 0.36,
        h: 0.28,
        align: "right",
        bold: true,
        color: Number(account.realizedBalance) >= 0 ? COLORS.greenDark : COLORS.red,
        fontFace: "Aptos Display",
        fontSize: 18,
        margin: 0,
        fit: "shrink",
      });
      balances.addText("Saldo realizado", {
        x: x + 0.18,
        y: y + 0.52,
        w: cardWidth - 0.36,
        h: 0.13,
        bold: true,
        charSpacing: 0.7,
        color: COLORS.muted,
        fontFace: "Aptos",
        fontSize: 6.8,
        margin: 0,
      });
    });
  }
  balances.addShape(SHAPE.roundRect, {
    x: 0.65,
    y: 5.72,
    w: 12.03,
    h: 0.85,
    rectRadius: 0.05,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
  balances.addText("TOTAL DISPONÍVEL", {
    x: 0.92,
    y: 5.98,
    w: 3.2,
    h: 0.2,
    bold: true,
    charSpacing: 1.2,
    color: "D7E5DF",
    fontFace: "Aptos",
    fontSize: 9,
    margin: 0,
  });
  balances.addText(money(view.summary.totalAvailable), {
    x: 8.25,
    y: 5.9,
    w: 4.05,
    h: 0.3,
    align: "right",
    bold: true,
    color: COLORS.white,
    fontFace: "Aptos Display",
    fontSize: 22,
    margin: 0,
    fit: "shrink",
  });
  addFooter(balances, 3);

  const agenda = presentation.addSlide();
  agenda.background = { color: COLORS.canvas };
  addInstitutionalHeader(agenda, "Agenda financeira", "Obrigações e recebíveis");
  addAgendaColumn(agenda, {
    x: 0.65,
    title: "Contas a Pagar",
    values: agendaValues(view, "PAYABLE"),
    entries: view.priorityPayables,
    emptyMessage: "Sem contas a pagar aplicáveis",
  });
  addAgendaColumn(agenda, {
    x: 6.83,
    title: "Contas a Receber",
    values: agendaValues(view, "RECEIVABLE"),
    entries: view.priorityReceivables,
    emptyMessage: "Sem contas a receber aplicáveis",
  });
  addFooter(agenda, 4);

  const evolution = presentation.addSlide();
  evolution.background = { color: COLORS.canvas };
  addInstitutionalHeader(evolution, "Evolução financeira", "Movimentação realizada mensal");
  const columns = [
    ["MÊS", 0.75, 2.2, "left"],
    ["ENTRADAS", 3.05, 2.65, "right"],
    ["SAÍDAS", 5.9, 2.65, "right"],
    ["RESULTADO", 8.75, 3.7, "right"],
  ] as const;
  evolution.addShape(SHAPE.roundRect, {
    x: 0.65,
    y: 1.28,
    w: 12.03,
    h: 0.55,
    rectRadius: 0.03,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
  columns.forEach(([label, x, w, align]) => {
    evolution.addText(label, {
      x,
      y: 1.47,
      w,
      h: 0.14,
      align,
      bold: true,
      color: COLORS.white,
      fontFace: "Aptos",
      fontSize: 8,
      margin: 0,
    });
  });
  if (!view.evolution.length) {
    addEmptyState(evolution, "Sem movimentação mensal no período", 0.65, 2, 12.03, 3.6);
  } else {
    view.evolution.slice(0, 8).forEach((item, index) => {
      const y = 1.91 + index * 0.56;
      evolution.addShape(SHAPE.rect, {
        x: 0.65,
        y,
        w: 12.03,
        h: 0.48,
        fill: { color: index % 2 === 0 ? COLORS.white : "F7FAF8" },
        line: { color: COLORS.line, width: 0.5 },
      });
      const values = [
        monthFormatter.format(new Date(`${item.competence}-01T00:00:00.000Z`)),
        money(item.totalReceived),
        money(item.totalPaid),
        money(item.realizedBalance),
      ];
      columns.forEach(([, x, w, align], columnIndex) => {
        evolution.addText(values[columnIndex], {
          x,
          y: y + 0.14,
          w,
          h: 0.17,
          align,
          bold: columnIndex === 3,
          color: columnIndex === 3 && Number(item.realizedBalance) < 0 ? COLORS.red : COLORS.slate,
          fontFace: "Aptos",
          fontSize: 10,
          margin: 0,
          fit: "shrink",
        });
      });
    });
  }
  addFooter(evolution, 5);

  const reading = presentation.addSlide();
  reading.background = { color: COLORS.canvas };
  addInstitutionalHeader(reading, "Leitura do período", "Síntese determinística");
  reading.addText("Síntese produzida exclusivamente a partir dos números consolidados no relatório.", {
    x: 0.65,
    y: 1.12,
    w: 12.03,
    h: 0.3,
    color: COLORS.muted,
    fontFace: "Aptos",
    fontSize: 13,
    margin: 0,
  });
  if (!view.reading.length) {
    addEmptyState(reading, "Sem dados suficientes para a leitura do período", 0.65, 1.72, 12.03, 3.8);
  } else {
    view.reading.slice(0, 7).forEach((item, index) => {
      const y = 1.72 + index * 0.69;
      reading.addShape(SHAPE.ellipse, {
        x: 0.78,
        y: y + 0.17,
        w: 0.12,
        h: 0.12,
        fill: { color: COLORS.green },
        line: { color: COLORS.green },
      });
      reading.addText(item, {
        x: 1.08,
        y,
        w: 11.2,
        h: 0.48,
        color: COLORS.slate,
        fontFace: "Aptos",
        fontSize: 15,
        margin: 0,
        breakLine: false,
        fit: "shrink",
        valign: "middle",
      });
    });
  }
  reading.addText("Centro de Gestão SV", {
    x: 0.65,
    y: 6.35,
    w: 4,
    h: 0.25,
    bold: true,
    color: COLORS.greenDark,
    fontFace: "Aptos Display",
    fontSize: 15,
    margin: 0,
  });
  reading.addText("SISTEMA INTEGRADO SV", {
    x: 0.65,
    y: 6.68,
    w: 4,
    h: 0.15,
    bold: true,
    charSpacing: 1.2,
    color: COLORS.gold,
    fontFace: "Aptos",
    fontSize: 7,
    margin: 0,
  });
  addFooter(reading, 6);

  return presentation;
}

export async function downloadFinancialExecutivePresentation(view: FinancialExecutiveReportView) {
  const presentation = createFinancialExecutivePresentation(view);
  return presentation.writeFile({
    fileName: financialExecutivePresentationFileName(view),
    compression: true,
  });
}
