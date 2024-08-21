import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";

// Parameters are always primitives, in order to make the query params more friendly (i.e. no JSON.stringify-quoted string query params).
export const useParameter = (key, defaultValue, searchParamKey) => {
  const [localStorageValue, saveLocalStorageValue] = useLocalStorage(
    key,
    defaultValue
  );

  useEffect(() => {
    const url = new URL(window.location);
    if (localStorageValue) {
      url.searchParams.set(
        searchParamKey || key,
        typeof localStorageValue === "object"
          ? JSON.stringify(localStorageValue)
          : localStorageValue
      );
    } else {
      url.searchParams.delete(searchParamKey || key);
    }
    window.history.pushState({}, undefined, url);
  }, [key, localStorageValue, searchParamKey]);

  return [localStorageValue, saveLocalStorageValue];
};
