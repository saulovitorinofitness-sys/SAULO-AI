# Sprint 004 — Modelo do Paciente

## Agregado cadastral

`Patient` armazena obrigatoriamente nome completo, CPF único, sexo, nascimento, e-mail, estado civil, profissão, status, versão, módulo e responsáveis pela criação e alteração.

O restante do cadastro foi normalizado em:

- `PatientAddress`: um endereço por paciente;
- `PatientPhone`: múltiplos telefones, com tipo e indicação do principal;
- `PatientInsurance`: um convênio por paciente;
- `PatientEmergencyContact`: múltiplos contatos, com indicação do principal.

Todos os componentes possuem status, versão, timestamps, módulo, criador e último alterador. O histórico permanece compatível com `RecordVersion`, `AuditEvent` e `AuditChange`.

## Prontuário Mestre

`MasterRecord.patientId` continua único. O contrato TypeScript `PatientAggregate` exige endereço, pelo menos um telefone, convênio, pelo menos um contato de emergência e `masterRecordId`.

Agenda referencia diretamente `MasterRecord`. Atendimento, avaliações e planos usam `MasterRecordEntry`; relatórios e entregáveis possuem relação obrigatória com `MasterRecord`. Nenhum desses modelos contém um cadastro paralelo de paciente.

## Limite transacional

O Prisma representa relações um-para-um obrigatórias do lado das entidades dependentes. A criação completa de `Patient`, endereço, convênio, telefone, contato de emergência e `MasterRecord` deve ocorrer em uma única transação do repositório de Pacientes quando a camada de aplicação for implementada.
