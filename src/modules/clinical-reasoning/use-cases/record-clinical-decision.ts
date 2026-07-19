import type { EntityId } from "../../shared";
import type {
  ClinicalDecisionRepository,
  ClinicalEvidenceRepository,
  ClinicalReasoningSessionRepository,
} from "../repositories";
import type {
  ClinicalClockService,
  ClinicalProfessionalContextService,
  ClinicalReasoningAuthorizationService,
} from "../services";
import { ClinicalReasoningFlowError } from "./open-clinical-reasoning-session";

export interface RecordClinicalDecisionInput {
  readonly sessionId: EntityId;
  readonly statement: string;
  readonly reason: string;
  readonly evidenceIds: readonly [EntityId, ...EntityId[]];
  readonly idempotencyKey: string;
}

export class RecordClinicalDecisionUseCase {
  constructor(
    private readonly sessionRepository: ClinicalReasoningSessionRepository,
    private readonly decisionRepository: ClinicalDecisionRepository,
    private readonly evidenceRepository: ClinicalEvidenceRepository,
    private readonly professionalContext: ClinicalProfessionalContextService,
    private readonly clock: ClinicalClockService,
    private readonly authorization: ClinicalReasoningAuthorizationService,
  ) {}

  async execute(input: RecordClinicalDecisionInput) {
    const existing = await this.decisionRepository.findByIdempotencyKey(input.sessionId, input.idempotencyKey);
    if (existing) return existing;

    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new ClinicalReasoningFlowError("SESSION_NOT_FOUND", "Clinical reasoning session was not found.");
    }

    const evidence = await this.evidenceRepository.findByIds(input.evidenceIds);
    if (evidence.length !== input.evidenceIds.length) {
      throw new ClinicalReasoningFlowError("EVIDENCE_NOT_FOUND", "One or more evidence references were not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanContribute(professionalUserId, session.id);

    return this.decisionRepository.createWithEvidence({
      ...input,
      professionalUserId,
      madeAt: this.clock.now(),
    });
  }
}
