export interface LegacyServiceReceiptCutoverState {
  readonly professionalServiceReceiptFlowReady: boolean;
  readonly disableLegacyServiceReceiptPost: boolean;
}

export function isLegacyServiceReceiptPostEnabled(
  state: LegacyServiceReceiptCutoverState,
): boolean {
  return !(
    state.professionalServiceReceiptFlowReady
    && state.disableLegacyServiceReceiptPost
  );
}

export function legacyServiceReceiptCutoverFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): LegacyServiceReceiptCutoverState {
  return Object.freeze({
    professionalServiceReceiptFlowReady:
      environment.PROFESSIONAL_SERVICE_RECEIPT_FLOW_READY === "true",
    disableLegacyServiceReceiptPost:
      environment.DISABLE_LEGACY_SERVICE_RECEIPT_POST === "true",
  });
}
