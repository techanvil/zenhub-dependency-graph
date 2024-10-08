import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export function atomWithParameterPersistence(
  key,
  initialValue,
  { bootstrapOptions = {}, runtimeOptions = {} } = {}
) {
  bootstrapParameter(key, bootstrapOptions);

  const storageAtom = {
    key: null,
    atom: null,
  };

  function getStorageAtom(get) {
    const storageKey = runtimeOptions.getLocalStorageKey?.(get) || key;

    if (storageAtom.key !== storageKey) {
      storageAtom.key = storageKey;
      storageAtom.atom = atomWithStorage(storageKey, initialValue, undefined, {
        getOnInit: true,
      });
    }

    return storageAtom.atom;
  }

  return atom(
    (get) => {
      const atom = getStorageAtom(get);
      return get(atom);
    },
    (get, set, value) => {
      const url = new URL(window.location);

      const atom = getStorageAtom(get);
      set(atom, value);

      if (value) {
        url.searchParams.set(
          key,
          typeof value === "object" ? JSON.stringify(value) : value
        );
      } else {
        url.searchParams.delete(key);
      }
      window.history.pushState({}, undefined, url);
    }
  );
}

export function bootstrapParameter(
  key,
  {
    parse = (v) => v,
    isObject,
    getLocalStorageKey, // `key` will be used if not provided.
    toLocalStorageValue,
  }
) {
  const url = new URL(window.location);

  if (url.searchParams.has(key)) {
    const value = isObject
      ? parse(JSON.parse(url.searchParams.get(key)))
      : parse(url.searchParams.get(key));

    const localStorageKey = getLocalStorageKey?.() || key;
    const localStorageValue = toLocalStorageValue?.(value) || value;

    // Local storage is always JSON.stringified.
    localStorage.setItem(localStorageKey, JSON.stringify(localStorageValue));
  } else {
    const localStorageKey = getLocalStorageKey?.() || key;

    const localValue = localStorage.getItem(localStorageKey);
    if (!localValue) return;

    let parsedValue;
    try {
      parsedValue = JSON.parse(localValue);
    } catch (err) {
      console.log("JSON parse error", err);
    }
    if (parsedValue) {
      url.searchParams.set(
        key,
        isObject ? JSON.stringify(parsedValue) : parsedValue
      );
      window.history.pushState({}, undefined, url);
    }
  }
}
