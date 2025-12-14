import { atom, createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { withUndo } from "jotai-history";
import { appSettingDefaults } from "../constants";
import {
  additionalColorDefaults,
  pipelineColorDefaults,
} from "../d3/constants";
import { atomWithParameterPersistence, atomWithQueryParameter } from "./utils";
import { toFixedDecimalPlaces } from "../d3/utils";
export * from "./atoms-typed";

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
// Last-known persisted dependency state for the currently loaded graph.
// In-memory only (not persisted to localStorage).
export const baselineGraphDataAtom = atom();
// Increment to force an SVG graph regeneration (re-run d3 generateGraph).
export const graphRenderNonceAtom = atom(0);

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

// Workspace should not really be persisted to local storage, but we'll keep it persistent for convenience.
export const workspaceAtom = atomWithParameterPersistence("workspace", "");

export const epicAtom = atomWithQueryParameter("epic", "", {
  parse: (v) => parseInt(v, 10),
});

export const isManualEpicAtom = atomWithQueryParameter("isManualEpic", false);

export const sprintAtom = atomWithQueryParameter("sprint", "");

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
