import {
  clinicInstitutionalDocumentIdentity,
  formatInstitutionalAddress,
  type InstitutionalDocumentIdentity as InstitutionalDocumentIdentityValue,
} from "@/config/institution";

export function InstitutionalDocumentIdentity({
  identity = clinicInstitutionalDocumentIdentity(),
  className = "",
  compact = false,
  tone = "default",
}: {
  readonly identity?: InstitutionalDocumentIdentityValue;
  readonly className?: string;
  readonly compact?: boolean;
  readonly tone?: "default" | "inverse";
}) {
  const contacts = identity.contacts.map((contact) => contact.value).join(" · ");
  const inverse = tone === "inverse";

  return (
    <div
      aria-label={`Identificação institucional de ${identity.displayName}`}
      className={`flex min-w-0 items-start ${compact ? "gap-2" : "gap-3"} ${className}`}
      data-institutional-identity="clinic-sv"
    >
      <div
        aria-label={`Símbolo da ${identity.displayName}`}
        className={`grid shrink-0 place-items-center font-black tracking-[0.08em] text-[#e2c675] ${compact ? "size-10 rounded-lg text-xs" : "size-12 rounded-xl text-sm"} ${inverse ? "border border-white/25 bg-white/10" : "bg-[#17644c]"}`}
      >
        {identity.shortName}
      </div>
      <div className="min-w-0">
        <p className={`${compact ? "text-sm" : "text-base"} font-black ${inverse ? "text-white" : "text-[#173c30]"}`}>{identity.displayName}</p>
        <p className={`mt-0.5 font-bold uppercase tracking-[0.15em] ${compact ? "text-[9px]" : "text-[10px]"} ${inverse ? "text-white/75" : "text-[#60746d]"}`}>{identity.documentSubtitle}</p>
        <address className={`mt-1 not-italic font-medium leading-[1.45] ${compact ? "text-[8px]" : "text-[9px]"} ${inverse ? "text-white/80" : "text-[#50655d]"}`}>
          <span className="block">{formatInstitutionalAddress(identity.address)}</span>
          <span className="block">WhatsApps: {contacts} · {identity.website}</span>
        </address>
      </div>
    </div>
  );
}
