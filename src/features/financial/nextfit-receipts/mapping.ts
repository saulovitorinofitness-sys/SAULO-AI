import type {
  NextFitReceiptMethod,
  NextFitReceiptReportFamily,
} from "./contracts";

export type NextFitReceiptDestination = {
  accountCode: "NUBANK" | "SUMUP" | "CAIXA_FISICO";
  paymentMethodCode: "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO";
};

const DESTINATIONS: Record<NextFitReceiptMethod, NextFitReceiptDestination> = {
  PIX_DEPOSIT: { accountCode: "NUBANK", paymentMethodCode: "PIX" },
  CREDIT_CARD: { accountCode: "SUMUP", paymentMethodCode: "CREDITO" },
  DEBIT_CARD: { accountCode: "SUMUP", paymentMethodCode: "DEBITO" },
  CASH: { accountCode: "CAIXA_FISICO", paymentMethodCode: "DINHEIRO" },
};

export function normalizeNextFitText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeNextFitReceiptMethod(
  rawMethod: unknown,
): NextFitReceiptMethod | null {
  const method = normalizeNextFitText(rawMethod).replace(/\s*\/\s*/g, "/");

  if (["pix", "pix/deposito", "deposito", "pix deposito"].includes(method)) {
    return "PIX_DEPOSIT";
  }

  if (["cartao de credito", "credito", "cartao credito"].includes(method)) {
    return "CREDIT_CARD";
  }

  if (["cartao de debito", "debito", "cartao debito"].includes(method)) {
    return "DEBIT_CARD";
  }

  if (["dinheiro", "dinheiro em especie", "especie"].includes(method)) {
    return "CASH";
  }

  return null;
}

export function getNextFitReceiptDestination(
  method: NextFitReceiptMethod,
): NextFitReceiptDestination {
  return DESTINATIONS[method];
}

export function getNextFitReceiptsReportFamily(
  methods: readonly NextFitReceiptMethod[],
): NextFitReceiptReportFamily {
  const distinct = new Set(methods);
  if (distinct.size !== 1) return "MIXED";
  if (distinct.has("PIX_DEPOSIT")) return "PIX_DEPOSIT";
  if (distinct.has("CASH")) return "CASH";
  return "CARDS";
}
