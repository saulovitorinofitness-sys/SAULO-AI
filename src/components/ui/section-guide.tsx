import type { ReactNode } from "react";

type SectionGuideProps = {
  readonly children: ReactNode;
};

export function SectionGuide({ children }: SectionGuideProps) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
        Pergunta Clínica
      </p>

      <div className="mt-1 flex items-start gap-2 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2">
        <span className="mt-0.5 text-base">💬</span>

        <p className="text-sm font-medium leading-6 text-slate-700">
          {children}
        </p>
      </div>
    </div>
  );
}