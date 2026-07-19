import type { EntityId } from "../../shared";
import type { ClinicalPriorityLevel } from "../domain";
import type { ClinicalAlertRepository, ClinicalReasoningSessionRepository } from "../repositories";
import type {
  ClinicalClockService,
  ClinicalProfessionalContextService,
  ClinicalReasoningAuthorizationService,
} from "../services";
import { ClinicalReasoningFlowError } from "./open-clinical-reasoning-session";

export interface RaiseClinicalAlertInput {
  readonly sessionId: EntityId;
  readonly findingId?: EntityId;
  readonly code: string;
  readonly message: string;
  readonly level: ClinicalPriorityLevel;
  readonly deduplicationKey: string;
}

export class RaiseClinicalAlertUseCase {
  constructor(
    private readonly sessionRepository: ClinicalReasoningSessionRepository,
    private readonly alertRepository: ClinicalAlertRepository,
    private readonly professionalContext: ClinicalProfessionalContextService,
    private readonly clock: ClinicalClockService,
    private readonly authorization: ClinicalReasoningAuthorizationService,
  ) {}

  async execute(input: RaiseClinicalAlertInput) {
    const existing = await this.alertRepository.findByDeduplicationKey(input.sessionId, input.deduplicationKey);
    if (existing) return existing;

    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new ClinicalReasoningFlowError("SESSION_NOT_FOUND", "Clinical reasoning session was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanContribute(professionalUserId, session.id);

    return this.alertRepository.raise({
      ...input,
      professionalUserId,
      status: "ACTIVE",
      raisedAt: this.clock.now(),
    });
  }
}
