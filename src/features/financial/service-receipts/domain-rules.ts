import { BUILT_IN_IDS } from "@/modules/permissions";

import type {
  IssuedServiceReceiptReference,
  ServiceReceiptAction,
  ServiceReceiptAuthorizationContext,
  ServiceReceiptCommercialUnit,
  ServiceReceiptItemCandidate,
  ServiceReceiptKind,
  ServiceReceiptPaymentCandidate,
  ServiceReceiptProviderKey,
  ServiceReceiptStatus,
  ServiceReceiptTotalsCandidate,
} from "./contracts";

const MONEY_PATTERN = /^(0|[1-9]\d*)\.\d{2}$/;

const NUTRITION_SERVICES = new Set<ServiceReceiptKind>([
  "NUTRITION_CONSULTATION",
  "NUTRITION_FOLLOW_UP",
  "NUTRITION_STRATEGY",
  "NUTRITION_PLAN",
]);

const PHYSICAL_EDUCATION_SERVICES = new Set<ServiceReceiptKind>([
  "PERSONAL_TRAINING",
  "STRENGTH_TRAINING_PLAN",
  "RUNNING_PLAN",
  "CYCLING_PLAN",
  "POSTURAL_ASSESSMENT",
  "PHYSICAL_FOLLOW_UP",
]);

export function serviceReceiptMoneyToCents(value: string): bigint {
  if (!MONEY_PATTERN.test(value)) {
    throw new Error("INVALID_MONEY");
  }
  const [whole, fraction] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction);
}

export function isNutritionService(kind: ServiceReceiptKind): boolean {
  return NUTRITION_SERVICES.has(kind);
}

export function isProviderAllowedForService(
  providerKey: ServiceReceiptProviderKey,
  serviceKind: ServiceReceiptKind,
): boolean {
  if (providerKey === "ACADEMIA_SAULO_FITNESS") return true;
  return PHYSICAL_EDUCATION_SERVICES.has(serviceKind);
}

export function isCommercialUnitAllowed(
  providerKey: ServiceReceiptProviderKey,
  serviceKind: ServiceReceiptKind,
  commercialUnit?: ServiceReceiptCommercialUnit,
): boolean {
  if (providerKey !== "ACADEMIA_SAULO_FITNESS") {
    return commercialUnit === undefined;
  }
  return isNutritionService(serviceKind)
    ? commercialUnit === "CLINICA_SV"
    : commercialUnit === "ACADEMIA_SAULO_FITNESS";
}

function hasValidPhysicalEducationExecutor(
  executor: ServiceReceiptItemCandidate["executors"][number],
): boolean {
  return executor.professionalRegistration === "CREF"
    && executor.professionalRegistrationStatus === "ACTIVE"
    && Boolean(executor.performedActivity.trim())
    && (
      executor.userId === BUILT_IN_IDS.users.sauloXavierVitorino
      || executor.userId === BUILT_IN_IDS.users.mariaDeLourdesGomes
    );
}

function hasUniqueExecutors(item: ServiceReceiptItemCandidate): boolean {
  return new Set(item.executors.map((executor) => executor.userId)).size
    === item.executors.length;
}

export function areExecutorsAllowedForService(
  item: ServiceReceiptItemCandidate,
): boolean {
  if (isNutritionService(item.kind)) {
    return item.executors.length === 1
      && item.executors[0].userId === BUILT_IN_IDS.users.sauloXavierVitorino
      && item.executors[0].professionalRegistration === "CRN"
      && item.executors[0].professionalRegistrationStatus === "ACTIVE"
      && Boolean(item.executors[0].performedActivity.trim());
  }

  if (item.kind === "ACADEMY_MEMBERSHIP") return item.executors.length === 0;

  if (item.kind === "ACADEMY_SERVICE" && item.executors.length === 0) return true;

  if (
    item.kind === "ACADEMY_SERVICE"
    || PHYSICAL_EDUCATION_SERVICES.has(item.kind)
  ) {
    return item.executors.length > 0
      && hasUniqueExecutors(item)
      && item.executors.every(hasValidPhysicalEducationExecutor);
  }

  return false;
}

export function groupServiceItemsByLegalProvider(
  items: readonly ServiceReceiptItemCandidate[],
): ReadonlyMap<ServiceReceiptProviderKey, readonly ServiceReceiptItemCandidate[]> {
  const grouped = new Map<ServiceReceiptProviderKey, ServiceReceiptItemCandidate[]>();
  for (const item of items) {
    const providerItems = grouped.get(item.legalProviderKey) ?? [];
    providerItems.push(item);
    grouped.set(item.legalProviderKey, providerItems);
  }
  return grouped;
}

export interface ServiceReceiptPaymentState {
  readonly amountDueInCents: bigint;
  readonly receivedInThisPaymentInCents: bigint;
  readonly totalReceivedInCents: bigint;
  readonly remainingBalanceInCents: bigint;
  readonly isPartialPayment: boolean;
}

export function calculateServiceReceiptPaymentState(
  totals: ServiceReceiptTotalsCandidate,
  payment: ServiceReceiptPaymentCandidate,
): ServiceReceiptPaymentState {
  const subtotal = serviceReceiptMoneyToCents(totals.subtotal);
  const discount = serviceReceiptMoneyToCents(totals.discount);
  const surcharge = serviceReceiptMoneyToCents(totals.surcharge);
  const amountDue = serviceReceiptMoneyToCents(totals.amountDue);
  const received = serviceReceiptMoneyToCents(payment.receivedAmount);
  const previouslyReceived = serviceReceiptMoneyToCents(
    payment.previouslyReceivedAmount,
  );

  if (subtotal - discount + surcharge !== amountDue) {
    throw new Error("TOTALS_MISMATCH");
  }
  if (discount > subtotal) {
    throw new Error("DISCOUNT_EXCEEDS_SUBTOTAL");
  }
  if (received === BigInt(0)) {
    throw new Error("PAYMENT_MUST_BE_POSITIVE");
  }

  const totalReceived = previouslyReceived + received;
  if (totalReceived > amountDue) {
    throw new Error("PAYMENT_EXCEEDS_AMOUNT_DUE");
  }

  const allocated = payment.allocations.reduce(
    (total, allocation) => total + serviceReceiptMoneyToCents(allocation.amount),
    BigInt(0),
  );
  if (allocated !== received) {
    throw new Error("PAYMENT_ALLOCATION_MISMATCH");
  }

  const remainingBalance = amountDue - totalReceived;
  return Object.freeze({
    amountDueInCents: amountDue,
    receivedInThisPaymentInCents: received,
    totalReceivedInCents: totalReceived,
    remainingBalanceInCents: remainingBalance,
    isPartialPayment: remainingBalance > BigInt(0),
  });
}

export function serviceReceiptDeclaredAmount(
  payment: ServiceReceiptPaymentCandidate,
): string {
  serviceReceiptMoneyToCents(payment.receivedAmount);
  return payment.receivedAmount;
}

function formattedCpf(value: string): string {
  const cpf = value.replace(/\D/gu, "");
  if (!/^\d{11}$/.test(cpf)) throw new Error("INVALID_CPF");
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export function customerCpfForCommonScreen(value: string): string {
  const cpf = formattedCpf(value);
  return `***.***.***-${cpf.slice(-2)}`;
}

export function customerCpfForDocument(
  value: string,
  visibility: "MASKED" | "FULL",
): string {
  return visibility === "FULL"
    ? formattedCpf(value)
    : customerCpfForCommonScreen(value);
}

export function canPerformServiceReceiptAction(
  userId: string,
  action: ServiceReceiptAction,
  context: ServiceReceiptAuthorizationContext,
): boolean {
  if (action === "CANCEL" || action === "REFUND") {
    return userId === BUILT_IN_IDS.users.sauloXavierVitorino;
  }
  if (userId === BUILT_IN_IDS.users.sauloXavierVitorino) {
    if (action === "READ" || action === "REGISTER") return true;
    const requiredCouncil = context.serviceKinds.some(isNutritionService)
      ? "CRN"
      : context.serviceKinds.some((kind) => PHYSICAL_EDUCATION_SERVICES.has(kind))
        ? "CREF"
        : null;
    return requiredCouncil === null
      || context.activeProfessionalCouncils.includes(requiredCouncil);
  }
  if (userId !== BUILT_IN_IDS.users.mariaDeLourdesGomes) return false;
  if (!context.activeProfessionalCouncils.includes("CREF")) return false;
  if (!context.serviceKinds.every((kind) => PHYSICAL_EDUCATION_SERVICES.has(kind))) {
    return false;
  }

  return context.legalProviderKey === "MARIA_DE_LOURDES_GOMES"
    || context.executorUserIds.includes(BUILT_IN_IDS.users.mariaDeLourdesGomes);
}

export function canReadServiceReceiptProof(
  userId: string,
  context: ServiceReceiptAuthorizationContext,
): boolean {
  return canPerformServiceReceiptAction(userId, "READ", context);
}

export function canCancelServiceReceipt(
  receipt: IssuedServiceReceiptReference,
  actorUserId: string,
): boolean {
  return receipt.status === "ISSUED"
    && actorUserId === BUILT_IN_IDS.users.sauloXavierVitorino;
}

export function canRegisterServiceReceiptRefund(actorUserId: string): boolean {
  return actorUserId === BUILT_IN_IDS.users.sauloXavierVitorino;
}

export function isValidReceiptStatusTransition(
  current: ServiceReceiptStatus,
  next: ServiceReceiptStatus,
): boolean {
  return current === "ISSUED" && next === "CANCELLED";
}

export function issuedReceiptFieldsAreImmutable(
  previous: IssuedServiceReceiptReference,
  next: IssuedServiceReceiptReference,
): boolean {
  return previous.id === next.id
    && previous.legalProviderKey === next.legalProviderKey
    && previous.series === next.series
    && previous.sequence === next.sequence;
}
