import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export const useParameter = (key, defaultValue) => {
  const [localStorageValue, saveLocalStorageValue] = useLocalStorage(
    key,
    defaultValue
  );

  const saveValue = useCallback(
    (value) => {
      saveLocalStorageValue(value);
      const url = new URL(window.location);
      url.searchParams.set(key, JSON.stringify(value));
      window.history.pushState({}, undefined, url);
    },
    [key, saveLocalStorageValue]
  );

  return [localStorageValue, saveValue];
};
