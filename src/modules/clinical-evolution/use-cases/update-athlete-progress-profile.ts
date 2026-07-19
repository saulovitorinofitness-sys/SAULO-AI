import type { EntityId } from "../../shared";
import type {
  AthleteProgressProfileRepository,
  AthleteProgressReferenceDraft,
} from "../repositories";
import type {
  ClinicalEvolutionAuthorizationService,
  EvolutionProfessionalContextService,
} from "../services";

export interface UpdateAthleteProgressProfileInput {
  readonly masterRecordId: EntityId;
  readonly references: readonly [AthleteProgressReferenceDraft, ...AthleteProgressReferenceDraft[]];
}

export class UpdateAthleteProgressProfileUseCase {
  constructor(
    private readonly repository: AthleteProgressProfileRepository,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(input: UpdateAthleteProgressProfileInput) {
    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanTrackAthlete(professionalUserId, input.masterRecordId);

    return this.repository.createOrAppendReferences(
      input.masterRecordId,
      professionalUserId,
      input.references,
    );
  }
}
