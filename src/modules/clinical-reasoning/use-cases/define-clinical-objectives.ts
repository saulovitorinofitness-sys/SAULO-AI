import type { EntityId } from "../../shared";
import type { ClinicalObjectiveRepository, ClinicalReasoningSessionRepository } from "../repositories";
import type {
  ClinicalClockService,
  ClinicalProfessionalContextService,
  ClinicalReasoningAuthorizationService,
} from "../services";
import { ClinicalReasoningFlowError } from "./open-clinical-reasoning-session";

export interface ObjectiveDraft {
  readonly title: string;
  readonly description?: string;
  readonly deduplicationKey: string;
}

export interface DefineClinicalObjectivesInput {
  readonly sessionId: EntityId;
  readonly primary: ObjectiveDraft;
  readonly secondary: readonly ObjectiveDraft[];
}

export class DefineClinicalObjectivesUseCase {
  constructor(
    private readonly sessionRepository: ClinicalReasoningSessionRepository,
    private readonly objectiveRepository: ClinicalObjectiveRepository,
    private readonly professionalContext: ClinicalProfessionalContextService,
    private readonly clock: ClinicalClockService,
    private readonly authorization: ClinicalReasoningAuthorizationService,
  ) {}

  async execute(input: DefineClinicalObjectivesInput) {
    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new ClinicalReasoningFlowError("SESSION_NOT_FOUND", "Clinical reasoning session was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanContribute(professionalUserId, session.id);
    const createdAt = this.clock.now();

    return this.objectiveRepository.createMany([
      {
        ...input.primary,
        sessionId: session.id,
        professionalUserId,
        type: "PRIMARY",
        sequence: 0,
        createdAt,
      },
      ...input.secondary.map((objective, index) => ({
        ...objective,
        sessionId: session.id,
        professionalUserId,
        type: "SECONDARY" as const,
        sequence: index + 1,
        createdAt,
      })),
    ]);
  }
}
