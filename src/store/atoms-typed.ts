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
  position: { x: number; y: number };
  isMeasuring: boolean;
  originalX: number | undefined;
  originalY: number | undefined;
  panZoomInstance: any; // TODO: Add type for panZoomInstance.
  dagWidth: number;
  dagHeight: number;
}

// Issue preview popup atoms
export const issuePreviewPopupAtom = atom<IssuePreviewPopupAtom>({
  isOpen: false,
  issueData: null,
  position: { x: 0, y: 0 },
  isMeasuring: false,
  originalX: undefined,
  originalY: undefined,
  panZoomInstance: null,
  dagWidth: 0,
  dagHeight: 0,
});
