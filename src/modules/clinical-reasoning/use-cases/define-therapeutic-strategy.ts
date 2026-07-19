import type { EntityId } from "../../shared";
import type { ClinicalReasoningSessionRepository, TherapeuticStrategyRepository } from "../repositories";
import type {
  ClinicalClockService,
  ClinicalProfessionalContextService,
  ClinicalReasoningAuthorizationService,
} from "../services";
import { ClinicalReasoningFlowError } from "./open-clinical-reasoning-session";

export interface DefineTherapeuticStrategyInput {
  readonly sessionId: EntityId;
  readonly title: string;
  readonly description: string;
  readonly idempotencyKey: string;
}

export class DefineTherapeuticStrategyUseCase {
  constructor(
    private readonly sessionRepository: ClinicalReasoningSessionRepository,
    private readonly strategyRepository: TherapeuticStrategyRepository,
    private readonly professionalContext: ClinicalProfessionalContextService,
    private readonly clock: ClinicalClockService,
    private readonly authorization: ClinicalReasoningAuthorizationService,
  ) {}

  async execute(input: DefineTherapeuticStrategyInput) {
    const existing = await this.strategyRepository.findByIdempotencyKey(input.sessionId, input.idempotencyKey);
    if (existing) return existing;

    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new ClinicalReasoningFlowError("SESSION_NOT_FOUND", "Clinical reasoning session was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanContribute(professionalUserId, session.id);

    return this.strategyRepository.define({
      ...input,
      professionalUserId,
      definedAt: this.clock.now(),
    });
  }
}
