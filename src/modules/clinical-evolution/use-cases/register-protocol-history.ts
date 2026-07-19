import type { EntityId, ISODate } from "../../shared";
import type { ProtocolStatus, ProtocolType } from "../domain";
import type { ClinicalEvolutionSessionRepository, ProtocolHistoryRepository } from "../repositories";
import type { ClinicalEvolutionAuthorizationService, EvolutionProfessionalContextService } from "../services";
import { ClinicalEvolutionFlowError } from "./open-clinical-evolution-session";

export interface RegisterProtocolHistoryUseCaseInput {
  readonly evolutionSessionId: EntityId;
  readonly strategyId?: EntityId;
  readonly protocolKey: string;
  readonly name: string;
  readonly type: ProtocolType;
  readonly startedAt: ISODate;
  readonly endedAt?: ISODate;
  readonly choiceReason: string;
  readonly responseEntryId?: EntityId;
  readonly responseNotes?: string;
  readonly status: ProtocolStatus;
  readonly nutritionExclusive: boolean;
}

export class RegisterProtocolHistoryUseCase {
  constructor(
    private readonly sessionRepository: ClinicalEvolutionSessionRepository,
    private readonly protocolRepository: ProtocolHistoryRepository,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(input: RegisterProtocolHistoryUseCaseInput) {
    const session = await this.sessionRepository.findById(input.evolutionSessionId);
    if (!session) {
      throw new ClinicalEvolutionFlowError("EVOLUTION_SESSION_NOT_FOUND", "Clinical evolution session was not found.");
    }

    const existing = await this.protocolRepository.findByKey(session.masterRecordId, input.protocolKey);
    if (existing) return existing;

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanManageProtocol(professionalUserId, input.type, input.nutritionExclusive);

    return this.protocolRepository.register({
      ...input,
      masterRecordId: session.masterRecordId,
      professionalUserId,
    });
  }
}
