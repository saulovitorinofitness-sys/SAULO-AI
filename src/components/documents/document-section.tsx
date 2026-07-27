import type { ReactNode } from "react";

export function DocumentSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="mt-7">
      <div className="mb-3">
        <h2 className="text-[15px] font-black text-[#173c30]">{title}</h2>
        {description ? (
          <p className="mt-1 text-[10px] leading-4 text-[#687a73]">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
