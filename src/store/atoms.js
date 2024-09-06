import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

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

export const APIKeyAtom = atomWithStorage("zenhubAPIKey", "");
