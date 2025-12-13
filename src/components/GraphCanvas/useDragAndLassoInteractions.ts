import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import type { CoordinateOverrides, GraphLayout } from "../../graph/layout";
import { roundToGrid } from "../../d3/utils";
import type { RuntimeNode } from "./types";
import { fromWorld, toWorld } from "./utils";

export type LassoBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
};

type DraggingState = {
  isDragging: boolean;
  pointerId: number | null;
  dragStartWorld: THREE.Vector3 | null;
  dragStartPositions: Map<string, { x: number; y: number }>;
  draggedIds: string[];
};

type DragCandidateState = {
  pointerId: number;
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startWorld: THREE.Vector3;
  draggedIds: string[];
  dragStartPositions: Map<string, { x: number; y: number }>;
  didMove: boolean;
};

type LassoState = {
  isLassoing: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type UseDragAndLassoParams = {
  camera: THREE.Camera;
  domElement: HTMLElement;
  layout: GraphLayout;
  nodes: RuntimeNode[];
  setNodes: Dispatch<SetStateAction<RuntimeNode[]>>;
  nodesById: Map<string, RuntimeNode>;
  appSettings: any;
  coordinateOverrides: CoordinateOverrides;
  saveCoordinateOverrides: (v: CoordinateOverrides) => void;
  onLassoBoxChange: (box: LassoBox) => void;
  cancelHoverPreview: () => void;
  hideIssuePopup: () => void;
  openIssue: (url: string) => void;
};

export function useDragAndLassoInteractions({
  camera,
  domElement,
  layout,
  nodes,
  setNodes,
  nodesById,
  appSettings,
  coordinateOverrides,
  saveCoordinateOverrides,
  onLassoBoxChange,
  cancelHoverPreview,
  hideIssuePopup,
  openIssue,
}: UseDragAndLassoParams) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [dampingEnabled, setDampingEnabled] = useState(true);

  const draggingRef = useRef<DraggingState>({
    isDragging: false,
    pointerId: null,
    dragStartWorld: null,
    dragStartPositions: new Map(),
    draggedIds: [],
  });

  const dragCandidateRef = useRef<DragCandidateState | null>(null);

  const lassoRef = useRef<LassoState>({
    isLassoing: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  function resetInteractions() {
    setSelectedIds(new Set());
    setControlsEnabled(true);
    setDampingEnabled(true);
    dragCandidateRef.current = null;
    draggingRef.current = {
      isDragging: false,
      pointerId: null,
      dragStartWorld: null,
      dragStartPositions: new Map(),
      draggedIds: [],
    };
    lassoRef.current = {
      isLassoing: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
    onLassoBoxChange({ x: 0, y: 0, w: 0, h: 0, visible: false });
  }

  function beginNodeDragCandidate(e: ThreeEvent<PointerEvent>, nodeId: string) {
    e.stopPropagation();
    if (e.button !== 0) return;

    cancelHoverPreview();
    hideIssuePopup();

    const isSelected = selectedIds.has(nodeId);
    const draggedIds = isSelected ? Array.from(selectedIds) : [nodeId];

    // If clicking a non-selected node, reset selection to just that node.
    if (!isSelected) {
      setSelectedIds(new Set([nodeId]));
    }

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const p = new THREE.Vector3();
    e.ray.intersectPlane(plane, p);

    dragCandidateRef.current = {
      pointerId: e.pointerId,
      nodeId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWorld: p.clone(),
      draggedIds,
      dragStartPositions: new Map(
        draggedIds
          .map((id) => nodesById.get(id))
          .filter((n): n is RuntimeNode => !!n)
          .map((n) => [n.id, { x: n.x, y: n.y }]),
      ),
      didMove: false,
    };

    // Disable controls + damping during node drag/drop so OrbitControls never "coasts"
    // or begins rotating while we are determining drag vs click.
    setControlsEnabled(false);
    setDampingEnabled(false);

    domElement.setPointerCapture?.(e.pointerId);
  }

  function updateNodePointer(e: ThreeEvent<PointerEvent>) {
    const cand = dragCandidateRef.current;
    if (!cand) return;
    if (cand.pointerId !== e.pointerId) return;
    e.stopPropagation();

    // Start drag only after a small movement threshold (prevents click opening tab).
    const dxScreen = e.clientX - cand.startClientX;
    const dyScreen = e.clientY - cand.startClientY;
    const dist2 = dxScreen * dxScreen + dyScreen * dyScreen;
    const threshold2 = 4 * 4;

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const p = new THREE.Vector3();
    e.ray.intersectPlane(plane, p);

    if (!draggingRef.current.isDragging) {
      if (dist2 < threshold2) return;

      cand.didMove = true;
      draggingRef.current.isDragging = true;
      draggingRef.current.pointerId = cand.pointerId;
      draggingRef.current.draggedIds = cand.draggedIds;
      draggingRef.current.dragStartPositions = cand.dragStartPositions;
      draggingRef.current.dragStartWorld = cand.startWorld.clone();

      setControlsEnabled(false);
    }

    // Active drag: update node positions
    if (!draggingRef.current.isDragging) return;
    if (draggingRef.current.pointerId !== e.pointerId) return;

    const start = draggingRef.current.dragStartWorld;
    if (!start) return;

    const delta = p.clone().sub(start);

    setNodes((prev) => {
      return prev.map((n) => {
        if (!draggingRef.current.draggedIds.includes(n.id)) return n;
        const base = draggingRef.current.dragStartPositions.get(n.id);
        if (!base) return n;
        const newWorld = toWorld(base.x, base.y, n.z).add(
          new THREE.Vector3(delta.x, delta.y, 0),
        );
        const { x, y } = fromWorld(newWorld);
        return { ...n, x, y };
      });
    });
  }

  function endNodePointer(e: ThreeEvent<PointerEvent>, node: RuntimeNode) {
    const cand = dragCandidateRef.current;
    if (!cand || cand.pointerId !== e.pointerId) return;
    e.stopPropagation();

    domElement.releasePointerCapture?.(e.pointerId);

    // If a drag was started, finish it and persist overrides.
    if (
      draggingRef.current.isDragging &&
      draggingRef.current.pointerId === e.pointerId
    ) {
      const draggedIds = [...draggingRef.current.draggedIds];
      draggingRef.current.isDragging = false;
      setControlsEnabled(true);
      setDampingEnabled(false);

      // Persist overrides
      setNodes((prev) => {
        const updated: CoordinateOverrides = { ...coordinateOverrides };
        const next = prev.map((n) => {
          if (!draggedIds.includes(n.id)) return n;

          let x = n.x;
          let y = n.y;
          if (appSettings.snapToGrid) {
            const [gx, gy] = roundToGrid(
              layout.gridWidth,
              layout.gridHeight,
              layout.nodeWidth,
              layout.nodeHeight,
              x,
              y,
            );
            x = gx;
            y = gy;
          }

          updated[n.id] = { x, y };
          return { ...n, x, y };
        });

        saveCoordinateOverrides(updated);
        return next;
      });

      draggingRef.current.pointerId = null;
      draggingRef.current.dragStartWorld = null;
      draggingRef.current.dragStartPositions = new Map();
      draggingRef.current.draggedIds = [];
    } else {
      // Click (no drag). Restore OrbitControls + damping and open issue.
      setControlsEnabled(true);
      setDampingEnabled(true);
      openIssue(node.data.htmlUrl);
    }

    dragCandidateRef.current = null;
  }

  function beginLasso(e: ThreeEvent<PointerEvent>) {
    // Shift+left-drag on background creates a lasso rectangle.
    // Normal left-drag remains OrbitControls rotate.
    if (e.button !== 0) return;
    if (!e.shiftKey) {
      // Click/drag on empty space clears selection (without interfering with OrbitControls).
      if (selectedIds.size) setSelectedIds(new Set());
      return;
    }
    e.stopPropagation();

    // Don't lasso while dragging nodes.
    if (draggingRef.current.isDragging || dragCandidateRef.current) return;

    cancelHoverPreview();
    hideIssuePopup();

    setControlsEnabled(false);
    setDampingEnabled(false);

    lassoRef.current.isLassoing = true;
    lassoRef.current.pointerId = e.pointerId;
    lassoRef.current.startX = e.clientX;
    lassoRef.current.startY = e.clientY;
    lassoRef.current.x = e.clientX;
    lassoRef.current.y = e.clientY;
    lassoRef.current.w = 0;
    lassoRef.current.h = 0;

    onLassoBoxChange({ x: e.clientX, y: e.clientY, w: 0, h: 0, visible: true });
    domElement.setPointerCapture?.(e.pointerId);
  }

  function updateLasso(e: ThreeEvent<PointerEvent>) {
    if (!lassoRef.current.isLassoing) return;
    if (lassoRef.current.pointerId !== e.pointerId) return;

    const x0 = lassoRef.current.startX;
    const y0 = lassoRef.current.startY;
    const x1 = e.clientX;
    const y1 = e.clientY;

    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);

    lassoRef.current.x = x;
    lassoRef.current.y = y;
    lassoRef.current.w = w;
    lassoRef.current.h = h;

    onLassoBoxChange({ x, y, w, h, visible: true });
  }

  function endLasso(e: ThreeEvent<PointerEvent>) {
    if (!lassoRef.current.isLassoing) return;
    if (lassoRef.current.pointerId !== e.pointerId) return;
    e.stopPropagation();

    lassoRef.current.isLassoing = false;
    lassoRef.current.pointerId = null;
    setControlsEnabled(true);
    domElement.releasePointerCapture?.(e.pointerId);

    onLassoBoxChange({ x: 0, y: 0, w: 0, h: 0, visible: false });

    const { x, y, w, h } = lassoRef.current;
    if (w < 4 || h < 4) {
      // Tiny drag: treat as click clearing selection.
      setSelectedIds(new Set());
      return;
    }

    const rect = domElement.getBoundingClientRect();
    const xMin = x - rect.left;
    const xMax = xMin + w;
    const yMin = y - rect.top;
    const yMax = yMin + h;

    const cam = camera as THREE.PerspectiveCamera;

    const nextSelected = new Set<string>();
    nodes.forEach((n) => {
      const world = toWorld(n.x, n.y, n.z);
      const ndc = world.clone().project(cam);
      const sx = (ndc.x * 0.5 + 0.5) * rect.width;
      const sy = (-ndc.y * 0.5 + 0.5) * rect.height;

      if (sx >= xMin && sx <= xMax && sy >= yMin && sy <= yMax) {
        nextSelected.add(n.id);
      }
    });

    setSelectedIds(nextSelected);
  }

  return {
    selectedIds,
    setSelectedIds,
    controlsEnabled,
    dampingEnabled,
    setDampingEnabled,
    draggingRef,
    lassoRef,
    resetInteractions,
    beginNodeDragCandidate,
    updateNodePointer,
    endNodePointer,
    beginLasso,
    updateLasso,
    endLasso,
  };
}
