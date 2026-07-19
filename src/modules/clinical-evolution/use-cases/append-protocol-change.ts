import type { EntityId } from "../../shared";
import type { ProtocolHistoryRepository } from "../repositories";
import type {
  ClinicalEvolutionAuthorizationService,
  EvolutionClockService,
  EvolutionProfessionalContextService,
} from "../services";
import { ClinicalEvolutionFlowError } from "./open-clinical-evolution-session";

export interface AppendProtocolChangeInput {
  readonly protocolHistoryId: EntityId;
  readonly description: string;
  readonly reason: string;
  readonly responseEntryId?: EntityId;
}

export class AppendProtocolChangeUseCase {
  constructor(
    private readonly protocolRepository: ProtocolHistoryRepository,
    private readonly professionalContext: EvolutionProfessionalContextService,
    private readonly clock: EvolutionClockService,
    private readonly authorization: ClinicalEvolutionAuthorizationService,
  ) {}

  async execute(input: AppendProtocolChangeInput) {
    const protocol = await this.protocolRepository.findById(input.protocolHistoryId);
    if (!protocol) {
      throw new ClinicalEvolutionFlowError("PROTOCOL_NOT_FOUND", "Protocol history was not found.");
    }

    const professionalUserId = await this.professionalContext.currentProfessionalUserId();
    await this.authorization.assertCanManageProtocol(
      professionalUserId,
      protocol.type,
      protocol.type === "NUTRITION",
    );

    return this.protocolRepository.appendChange({
      ...input,
      professionalUserId,
      changedAt: this.clock.now(),
    });
  }
}
