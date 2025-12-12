import { atom } from "jotai";

// TODO: Migrate the JS atoms to this file.

interface IssueData {
  id: string;
  title: string;
  body: string;
  htmlUrl: string;
  assignees: string[];
  estimate?: string;
  pipelineName: string;
}

interface IssuePreviewPopupAtom {
  isOpen: boolean;
  issueData: IssueData | null;
  isMeasuring: boolean;
  // Screen-space top-left position for the popup (CSS `position: fixed`).
  position: { x: number; y: number };

  // Screen-space anchor point for the popup (usually the hovered node projected
  // from world -> screen).
  anchor?: { x: number; y: number };

  // World-space anchor (for when the renderer wants to keep it attached to a node).
  world?: { x: number; y: number; z: number };

  // Last measured popup size (used to keep the popup on-screen when the anchor moves).
  popupSize?: { width: number; height: number };
}

// Issue preview popup atoms
export const issuePreviewPopupAtom = atom<IssuePreviewPopupAtom>({
  isOpen: false,
  issueData: null,
  position: { x: 0, y: 0 },
  isMeasuring: false,
  anchor: undefined,
  world: undefined,
  popupSize: undefined,
});
