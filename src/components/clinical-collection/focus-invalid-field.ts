import type { FormEvent } from "react";

export function focusFirstInvalidField(
  event: FormEvent<HTMLFormElement>,
) {
  const firstInvalid =
    event.currentTarget.querySelector<HTMLElement>(":invalid");
  if (!firstInvalid || event.target !== firstInvalid) return;

  requestAnimationFrame(() => {
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid.focus({ preventScroll: true });
  });
}
