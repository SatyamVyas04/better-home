/** Shared animation helpers for users who ask for reduced motion. */

/**
 * Helper for CSS/Tailwind-driven animations (`animate-spin`, etc.) once
 * a JS-level reduced motion preference is checked.
 * When reduced motion is preferred, switches high-movement animations like
 * `animate-spin` to a gentle non-vestibular pulse (`animate-pulse`).
 */
export function getMotionReducedAnimationClass(
  prefersReducedMotion: boolean,
  animationClass: "animate-spin"
): string {
  if (!prefersReducedMotion) {
    return animationClass;
  }

  return animationClass === "animate-spin" ? "animate-pulse" : "";
}
