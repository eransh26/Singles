import { RefObject, useEffect, useRef } from "react";

type UseDismissibleLayerOptions = {
  open: boolean;
  onDismiss: () => void;
  refs: Array<RefObject<HTMLElement | null>>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  lockScroll?: boolean;
};

export function useDismissibleLayer({
  open,
  onDismiss,
  refs,
  restoreFocusRef,
  lockScroll = false,
}: UseDismissibleLayerOptions) {
  const refsRef = useRef(refs);
  const onDismissRef = useRef(onDismiss);
  const restoreFocusRefRef = useRef(restoreFocusRef);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  refsRef.current = refs;
  onDismissRef.current = onDismiss;
  restoreFocusRefRef.current = restoreFocusRef;

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        const focusTarget = restoreFocusRefRef.current?.current ?? lastFocusedElementRef.current;
        if (focusTarget && typeof focusTarget.focus === "function") {
          requestAnimationFrame(() => focusTarget.focus());
        }
      }
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function containsTarget(target: Node) {
      return refsRef.current.some((ref) => {
        const node = ref.current;
        return node ? node.contains(target) : false;
      });
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containsTarget(event.target as Node)) {
        onDismissRef.current();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismissRef.current();
      }
    }

    const originalOverflow = document.body.style.overflow;
    if (lockScroll) {
      document.body.style.overflow = "hidden";
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      if (lockScroll) {
        document.body.style.overflow = originalOverflow;
      }
    };
  }, [lockScroll, open]);
}
