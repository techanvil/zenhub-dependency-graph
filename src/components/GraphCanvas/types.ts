import { GraphIssue } from "../../graph/layout";

export type RuntimeNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  opacity: number;
  color: string;
  data: GraphIssue;
};
