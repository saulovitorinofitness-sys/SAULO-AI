import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";

export function DocumentHeader({
  issuedAt,
  patient,
}: {
  issuedAt: string;
  patient: {
    fullName: string;
    age?: number;
    sex?: string;
    phone?: string;
    objective?: string;
  };
}) {
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(new Date(issuedAt));

  return (
    <header className="border-b-2 border-[#17644c] pb-6">
      <div className="flex items-start justify-between gap-5">
        <InstitutionalDocumentIdentity />

        <p className="max-w-[42%] text-right text-[10px] font-medium leading-4 text-[#60746d]">
          Emitido em {formattedDate}
        </p>
      </div>

      <div className="mt-8">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a17d2e]">
          Entregável profissional
        </p>
        <h1 className="mt-2 text-[27px] font-black leading-tight tracking-tight text-[#173c30]">
          Plano Alimentar Personalizado
        </h1>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[#dfe7e3] pt-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">
            Paciente
          </dt>
          <dd className="mt-1 text-sm font-black text-[#243b33]">
            {patient.fullName}
          </dd>
        </div>

        {typeof patient.age === "number" ? (
          <div>
            <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">
              Idade
            </dt>
            <dd className="mt-1 text-xs font-bold text-[#243b33]">
              {patient.age} anos
            </dd>
          </div>
        ) : null}

        {patient.sex ? (
          <div>
            <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">
              Sexo
            </dt>
            <dd className="mt-1 text-xs font-bold text-[#243b33]">
              {patient.sex}
            </dd>
          </div>
        ) : null}

        {patient.phone ? (
          <div>
            <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">
              Telefone
            </dt>
            <dd className="mt-1 text-xs font-bold text-[#243b33]">
              {patient.phone}
            </dd>
          </div>
        ) : null}

        {patient.objective ? (
          <div className="col-span-2">
            <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">
              Objetivo nutricional
            </dt>
            <dd className="mt-1 text-xs font-bold text-[#243b33]">
              {patient.objective}
            </dd>
          </div>
        ) : null}

        <div>
          <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">
            Data de emissão
          </dt>
          <dd className="mt-1 text-xs font-bold text-[#243b33]">
            {formattedDate}
          </dd>
        </div>
      </dl>
    </header>
  );
}
