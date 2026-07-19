import type { EntityId, JsonValue } from "../../shared";
import type { ClinicalFindingCategory } from "../domain";
import type { ClinicalFindingRepository, ClinicalReasoningSessionRepository } from "../repositories";
import type {
  ClinicalClockService,
  ClinicalPriorityClassifierService,
  ClinicalProfessionalContextService,
  ClinicalReasoningAuthorizationService,
} from "../services";
import { ClinicalReasoningFlowError } from "./open-clinical-reasoning-session";

export interface RegisterClinicalFindingInput {
  readonly sessionId: EntityId;
  readonly code: string;
  readonly label: string;
  readonly description?: string;
  readonly category: ClinicalFindingCategory;
  readonly deduplicationKey: string;
  readonly sourceReference?: JsonValue;
}

export class RegisterClinicalFindingUseCase {
  constructor(
    private readonly sessionRepository: ClinicalReasoningSessionRepository,
    private readonly findingRepository: ClinicalFindingRepository,
    private readonly priorityClassifier: ClinicalPriorityClassifierService,
    private readonly professionalContext: ClinicalProfessionalContextService,
    private readonly clock: ClinicalClockService,
    private readonly authorization: ClinicalReasoningAuthorizationService,
  ) {}

  async execute(input: RegisterClinicalFindingInput) {
    const existing = await this.findingRepository.findByDeduplicationKey(input.sessionId, input.deduplicationKey);
    if (existing) return existing;

    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new ClinicalReasoningFlowError("SESSION_NOT_FOUND", "Clinical reasoning session was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanContribute(professionalUserId, session.id);

    const priorityLevel = await this.priorityClassifier.classify({
      code: input.code,
      label: input.label,
      category: input.category,
    });

    return this.findingRepository.createWithPriority({
      ...input,
      professionalUserId,
      observedAt: this.clock.now(),
      priorityLevel,
    });
  }
}
