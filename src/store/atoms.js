import { atom } from "jotai";

export const PANES = {
  NONE: "none",
  SETTINGS: "settings",
  LEGEND: "legend",
  EXTERNAL: "external",
};

export const activePaneAtom = atom(PANES.NONE);
