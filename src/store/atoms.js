import { atom, createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { withUndo } from "jotai-history";
import { appSettingDefaults } from "../constants";
import {
  additionalColorDefaults,
  pipelineColorDefaults,
} from "../d3/constants";
import { atomWithParameterPersistence } from "./utils";
import { toFixedDecimalPlaces } from "../d3/utils";

export const PANES = {
  NONE: "none",
  SETTINGS: "settings",
  LEGEND: "legend",
  EXTERNAL: "external",
};

export const store = createStore();

export const activePaneAtom = atom(PANES.NONE);

export const nonEpicIssuesAtom = atom();
export const selfContainedIssuesAtom = atom();
export const hiddenIssuesAtom = atom();
export const currentGraphDataAtom = atom();

export const APIKeyAtom = atomWithStorage("zenhubAPIKey", "", undefined, {
  getOnInit: true,
});

export const appSettingsAtom = atomWithParameterPersistence(
  "appSettings",
  {}, // Initial value.
  {
    bootstrapOptions: {
      isObject: true,
      parse: (appSettings) => ({
        ...appSettingDefaults,
        ...appSettings,
      }),
    },
  },
);

export const workspaceAtom = atomWithParameterPersistence("workspace", "");

export const epicAtom = atomWithParameterPersistence("epic", "", {
  bootstrapOptions: {
    parse: (v) => parseInt(v, 10),
  },
});

export const sprintAtom = atomWithParameterPersistence("sprint", "");

export const pipelineColorsAtom = atomWithParameterPersistence(
  "pipelineColors",
  pipelineColorDefaults,
  {
    bootstrapOptions: {
      isObject: true,
    },
  },
);

export const additionalColorsAtom = atomWithParameterPersistence(
  "additionalColors",
  additionalColorDefaults,
  {
    bootstrapOptions: {
      isObject: true,
    },
  },
);

// TODO: Merge pipelineColors and pipelineHidden if more pipeline settings are added?
export const pipelineHiddenAtom = atomWithParameterPersistence(
  "pipelineHidden",
  {},
  {
    bootstrapOptions: {
      isObject: true,
    },
  },
);

export const coordinateOverridesAtom = atomWithParameterPersistence(
  "coordinateOverrides",
  {},
  {
    bootstrapOptions: {
      isObject: true,
      getLocalStorageKey: () => {
        const url = new URL(window.location);

        // By now the epic should be set. If not, bail out.
        const epic = url.searchParams.get("epic");
        if (!epic) return null;

        return `coordinateOverrides-${epic}`;
      },
      toLocalStorageValue: (coordinateOverrides) => {
        const url = new URL(window.location);

        // By now the epic should be set. If not, bail out.
        const epic = url.searchParams.get("epic");
        if (!epic) return null;

        return coordinateOverridesToLocalStorageValue(
          coordinateOverrides,
          epic,
        );
      },
    },
    runtimeOptions: {
      getLocalStorageKey: (get) => {
        const epic = get(epicAtom);
        if (!epic) return null;

        return `coordinateOverrides-${epic}`;
      },
    },
  },
);

export const undoCoordinateOverridesAtom = withUndo(
  coordinateOverridesAtom,
  100,
);

function coordinateOverridesToLocalStorageValue(coordinateOverrides, epic) {
  function firstValue(obj) {
    return Object.values(obj)[0];
  }

  const isOldFormat =
    typeof firstValue(coordinateOverrides) === "object" &&
    typeof firstValue(firstValue(coordinateOverrides)) === "object";

  if (isOldFormat) {
    // Migrate legacy coordinateOverrides to new format.
    Object.entries(coordinateOverrides).forEach(
      ([epicNumber, epicOverrides]) => {
        localStorage.setItem(
          `coordinateOverrides-${epicNumber}`,
          JSON.stringify(
            Object.entries(epicOverrides).reduce(
              (overrides, [issueNumber, coordinates]) => {
                overrides[issueNumber] = {
                  x: toFixedDecimalPlaces(parseFloat(coordinates.x), 1),
                  y: toFixedDecimalPlaces(parseFloat(coordinates.y), 1),
                };

                return overrides;
              },
              {},
            ),
          ),
        );
      },
    );

    localStorage.removeItem("coordinateOverrides");

    return JSON.parse(
      localStorage.getItem(`coordinateOverrides-${epic}`) || "{}",
    );
  }

  return coordinateOverrides;
}
