/** Sticky nav clearance when scrolling to the build input. */
export const BUILD_SCROLL_OFFSET = 88;

export function scrollToBuildBox(focusInput = true) {
  if (typeof window === "undefined") return;
  const el = document.getElementById("build-box");
  if (!el) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const top = el.getBoundingClientRect().top + window.scrollY - BUILD_SCROLL_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  if (focusInput) {
    window.setTimeout(() => {
      el.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
    }, 480);
  }
}
