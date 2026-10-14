import { useEffect, useState } from "react";

export function useWindowActivityGuard(): { isWindowActive: boolean } {
  const [isWindowActive, setIsWindowActive] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.visibilityState === "visible";
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const applyState = (active: boolean) => {
      setIsWindowActive(active);
      if (active) {
        document.documentElement.classList.remove("app-backgrounded");
      } else {
        document.documentElement.classList.add("app-backgrounded");
      }
    };

    const handleVisibilityChange = () => {
      applyState(document.visibilityState === "visible");
    };

    const handleFocus = () => {
      applyState(true);
    };

    const handleBlur = () => {
      applyState(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Initial check
    applyState(document.visibilityState === "visible");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.documentElement.classList.remove("app-backgrounded");
    };
  }, []);

  return { isWindowActive };
}
