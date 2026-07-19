import type { EntityId } from "../../shared";
import type {
  ClinicalEvolutionSessionRepository,
  EvolutionAssociatedFactorRepository,
  EvolutionFactorDraft,
} from "../repositories";
import type {
  ClinicalEvolutionAuthorizationService,
  EvolutionClockService,
  EvolutionProfessionalContextService,
} from "../services";
import { ClinicalEvolutionFlowError } from "./open-clinical-evolution-session";

export interface RecordEvolutionFactorsInput {
  readonly sessionId: EntityId;
  readonly factors: readonly [EvolutionFactorDraft, ...EvolutionFactorDraft[]];
}

export class RecordEvolutionFactorsUseCase {
  constructor(
    private readonly sessionRepository: ClinicalEvolutionSessionRepository,
    private readonly factorRepository: EvolutionAssociatedFactorRepository,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly clock: EvolutionClockService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(input: RecordEvolutionFactorsInput) {
    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new ClinicalEvolutionFlowError("EVOLUTION_SESSION_NOT_FOUND", "Clinical evolution session was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanRecordFactors(
      professionalUserId,
      input.factors.map((factor) => factor.type),
    );

    return this.factorRepository.createMany(
      session.id,
      professionalUserId,
      this.clock.now(),
      input.factors,
    );
  }
}
