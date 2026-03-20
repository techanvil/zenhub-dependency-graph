import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useColorMode } from "@chakra-ui/react";
import { colorModePreferenceAtom } from "../store/atoms";

function getSystemColorMode(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useColorModeSync() {
  const preference = useAtomValue(colorModePreferenceAtom);
  const { setColorMode } = useColorMode();

  useEffect(() => {
    if (preference === "system") {
      setColorMode(getSystemColorMode());

      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        setColorMode(e.matches ? "dark" : "light");
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }

    setColorMode(preference);
  }, [preference, setColorMode]);
}
