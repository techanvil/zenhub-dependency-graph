import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { appSettingDefaults } from "../constants";

export const PANES = {
  NONE: "none",
  SETTINGS: "settings",
  LEGEND: "legend",
  EXTERNAL: "external",
};

export const activePaneAtom = atom(PANES.NONE);

export const nonEpicIssuesAtom = atom();
export const selfContainedIssuesAtom = atom();
export const hiddenIssuesAtom = atom();
export const currentGraphDataAtom = atom();

export const APIKeyAtom = atomWithStorage("zenhubAPIKey", "", undefined, {
  getOnInit: true,
});

function bootstrapParameter({
  key,
  parse = (v) => v,
  isObject,
  toLocalStorage,
  fromLocalStorage,
}) {
  const url = new URL(window.location);

  if (url.searchParams.has(key)) {
    const value = isObject
      ? parse(JSON.parse(url.searchParams.get(key)))
      : parse(url.searchParams.get(key));

    const { localStorageKey, localStorageValue } =
      toLocalStorage?.(value) || {};

    // Local storage is always JSON.stringified.
    localStorage.setItem(
      localStorageKey || key,
      JSON.stringify(localStorageValue || value)
    );
  } else {
    const { localStorageKey } = fromLocalStorage?.() || {};

    const localValue = localStorage.getItem(localStorageKey || key);
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
        isObject ? JSON.stringify(localValue) : localValue
      );
      window.history.pushState({}, undefined, url);
    }
  }
}

function atomWithParameterPersistence(
  key,
  initialValue,
  { bootstrapOptions = {} } = {}
) {
  bootstrapParameter(key, bootstrapOptions);

  const storageAtom = atomWithStorage(
    key,
    initialValue
    /* TODO: In order to override key:
    {
      getItem(key, initialValue) {},
      setItem(key, value) {},
      removeItem(key) {},
    }
    */
  );

  return atom(
    (get) => get(storageAtom),
    (get, set, value) => {
      const url = new URL(window.location);

      set(storageAtom, value);

      if (value) {
        url.searchParams.set(
          // searchParamKey || key,
          // TODO: Use fromLocalStorage to get the key.
          key,
          typeof value === "object" ? JSON.stringify(value) : value
        );
      } else {
        // url.searchParams.delete(searchParamKey || key);
        // TODO: Use fromLocalStorage to get the key.
        url.searchParams.delete(key);
      }
      window.history.pushState({}, undefined, url);
    }
  );
}

export const appSettingsAtom = atomWithParameterPersistence(
  "appSettings",
  {}, // Default value.
  {
    bootstrapOptions: {
      isObject: true,
      parse: (appSettings) => ({
        ...appSettingDefaults,
        ...appSettings,
      }),
    },
  }
);
export const workspaceAtom = atomWithParameterPersistence("workspace", "");
export const epicAtom = atomWithParameterPersistence("epic", "", {
  bootstrapOptions: {
    parse: (v) => parseInt(v, 10),
  },
});
