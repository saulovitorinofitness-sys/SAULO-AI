import type { HTMLAttributes } from "react";
export function Divider({ className = "", ...props }: HTMLAttributes<HTMLHRElement>) { return <hr className={`border-0 border-t border-[var(--line)] ${className}`} {...props} />; }
