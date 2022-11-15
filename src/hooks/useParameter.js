import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";

export const useParameter = (key, defaultValue) => {
  const [localStorageValue, saveLocalStorageValue] = useLocalStorage(
    key,
    defaultValue
  );

  useEffect(() => {
    const url = new URL(window.location);
    if (localStorageValue) {
      url.searchParams.set(key, JSON.stringify(localStorageValue));
    } else {
      url.searchParams.delete(key);
    }
    window.history.pushState({}, undefined, url);
  }, [key, localStorageValue]);

  return [localStorageValue, saveLocalStorageValue];
};
