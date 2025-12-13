import type { Dispatch, SetStateAction } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import type { GraphIssue } from "../../graph/layout";
import { issuePreviewPopupAtom, store } from "../../store/atoms";
import type { RuntimeNode } from "./types";

export type HoverPreviewRefState = {
  timeout: number | null;
  nodeId: string | null;
  issue: GraphIssue | null;
  world: { x: number; y: number; z: number } | null;
  ctrlKey: boolean;
};

type IssueNodeInteractionDeps = {
  appSettings: any;
  camera: THREE.Camera;
  domElement: HTMLElement;
  draggingRef: { current: { isDragging: boolean } };
  lassoRef: { current: { isLassoing: boolean } };
  setHoveredId: Dispatch<SetStateAction<string | null>>;
  hoverPreviewRef: { current: HoverPreviewRefState };
  cancelHoverPreview: () => void;
  beginNodeDragCandidate: (e: ThreeEvent<PointerEvent>, nodeId: string) => void;
  updateNodePointer: (e: ThreeEvent<PointerEvent>) => void;
  endNodePointer: (e: ThreeEvent<PointerEvent>, node: RuntimeNode) => void;
};

type IssueNodeContext = {
  node: RuntimeNode;
  position: THREE.Vector3;
};

export function createIssueNodeInteractions(
  deps: IssueNodeInteractionDeps,
  ctx: IssueNodeContext,
) {
  const { node, position } = ctx;

  return {
    onHoverSetAndSchedulePreview: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      if (
        !deps.draggingRef.current.isDragging &&
        !deps.lassoRef.current.isLassoing
      ) {
        deps.setHoveredId(node.id);
      }

      deps.hoverPreviewRef.current.nodeId = node.id;
      deps.hoverPreviewRef.current.issue = node.data;
      deps.hoverPreviewRef.current.world = {
        x: position.x,
        y: position.y,
        z: position.z,
      };
      deps.hoverPreviewRef.current.ctrlKey = !!e.ctrlKey;

      deps.cancelHoverPreview();

      if (deps.appSettings.showIssuePreviews && !e.ctrlKey) {
        deps.hoverPreviewRef.current.timeout = window.setTimeout(() => {
          if (
            deps.draggingRef.current.isDragging ||
            deps.lassoRef.current.isLassoing ||
            deps.hoverPreviewRef.current.nodeId !== node.id
          ) {
            return;
          }

          const issueData = {
            id: node.data.id,
            title: node.data.title,
            body: node.data.body || "",
            htmlUrl: node.data.htmlUrl,
            assignees: node.data.assignees || [],
            estimate: node.data.estimate,
            pipelineName: node.data.pipelineName,
          };

          const rect = deps.domElement.getBoundingClientRect();
          const w = deps.hoverPreviewRef.current.world;
          if (!w) return;

          const world = new THREE.Vector3(w.x, w.y, w.z);
          const ndc = world
            .clone()
            .project(deps.camera as THREE.PerspectiveCamera);
          const anchorX = (ndc.x * 0.5 + 0.5) * rect.width + rect.left;
          const anchorY = (-ndc.y * 0.5 + 0.5) * rect.height + rect.top;

          store.set(issuePreviewPopupAtom, {
            isOpen: false,
            issueData,
            position: { x: -9999, y: -9999 },
            isMeasuring: true,
            anchor: { x: anchorX, y: anchorY },
            world: { x: w.x, y: w.y, z: w.z },
            popupSize: undefined,
          });
        }, 1000);
      }
    },

    onHoverClearAndCancelPreview: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();

      if (
        !deps.draggingRef.current.isDragging &&
        !deps.lassoRef.current.isLassoing
      ) {
        deps.setHoveredId((curr) => (curr === node.id ? null : curr));
      }

      deps.cancelHoverPreview();
      deps.hoverPreviewRef.current.nodeId = null;
      deps.hoverPreviewRef.current.issue = null;
      deps.hoverPreviewRef.current.world = null;
    },

    onPressStartDragCandidate: (e: ThreeEvent<PointerEvent>) =>
      deps.beginNodeDragCandidate(e, node.id),

    onMoveUpdateDrag: deps.updateNodePointer,

    onReleaseCommitDragOrOpen: (e: ThreeEvent<PointerEvent>) =>
      deps.endNodePointer(e, node),
  };
}
