import { useEffect, useRef } from "react";

/**
 * Enables ArrowLeft and ArrowRight keyboard navigation between buttons in a container.
 * Also supports Enter / Space to click, and Escape to close.
 */
export function useKeyboardArrowNav<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean = true,
  onEscape?: () => void,
) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (!containerRef.current) return;

      const focusableElements = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex="0"]:not([disabled]), input:not([disabled])',
        ),
      ).filter((el) => el.offsetParent !== null); // only visible elements

      if (focusableElements.length === 0) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const currentIndex = activeEl ? focusableElements.indexOf(activeEl) : -1;

      // Don't intercept arrow keys if typing inside a text input / textarea
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
        (activeEl as HTMLInputElement).type !== "button" &&
        (activeEl as HTMLInputElement).type !== "submit"
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        focusableElements[nextIndex]?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        focusableElements[prevIndex]?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onEscape]);

  return containerRef;
}
