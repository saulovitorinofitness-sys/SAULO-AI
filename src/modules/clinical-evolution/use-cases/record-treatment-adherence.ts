import type { EntityId } from "../../shared";
import type { TreatmentAdherenceItemDraft, TreatmentAdherenceRepository } from "../repositories";
import type {
  ClinicalEvolutionAuthorizationService,
  EvolutionClockService,
  EvolutionProfessionalContextService,
} from "../services";

export interface RecordTreatmentAdherenceInput {
  readonly sessionId: EntityId;
  readonly items: readonly [TreatmentAdherenceItemDraft, ...TreatmentAdherenceItemDraft[]];
}

export class RecordTreatmentAdherenceUseCase {
  constructor(
    private readonly repository: TreatmentAdherenceRepository,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly clock: EvolutionClockService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(input: RecordTreatmentAdherenceInput) {
    const existing = await this.repository.findBySessionId(input.sessionId);
    if (existing) return existing;

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanRecordAdherence(
      professionalUserId,
      input.items.map((item) => item.category),
    );

    return this.repository.create(input.sessionId, professionalUserId, this.clock.now(), input.items);
  }
}
