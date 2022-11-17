import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";

// Parameters are always primitives, in order to make the query params more friendly (i.e. no JSON.stringify-quoted string query params).
export const useParameter = (key, defaultValue) => {
  const [localStorageValue, saveLocalStorageValue] = useLocalStorage(
    key,
    defaultValue
  );

  useEffect(() => {
    const url = new URL(window.location);
    if (localStorageValue) {
      url.searchParams.set(key, localStorageValue);
    } else {
      url.searchParams.delete(key);
    }
    window.history.pushState({}, undefined, url);
  }, [key, localStorageValue]);

  return [localStorageValue, saveLocalStorageValue];
};
