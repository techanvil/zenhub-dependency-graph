import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Text as ChakraText } from "@chakra-ui/react";
import { Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { useAtomValue } from "jotai";

import {
  computeGraphLayout,
  CoordinateOverrides,
  GraphIssue,
  GraphLayout,
} from "../../graph/layout";
import { getIntersection, roundToGrid } from "../../d3/utils";
import { issuePreviewPopupAtom, store } from "../../store/atoms";

type GraphCanvasProps = {
  graphData: GraphIssue[];
  appSettings: any;
  pipelineColors: Record<string, string>;
  additionalColors: Record<string, string>;
  coordinateOverrides: CoordinateOverrides;
  saveCoordinateOverrides: (v: CoordinateOverrides) => void;
  setCurrentGraphData: (v: any) => void;
};

type RuntimeNode = {
  id: string;
  x: number;
  y: number;
  opacity: number;
  color: string;
  data: GraphIssue;
};

type LassoBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
};

function toWorld(x: number, y: number) {
  // Flip Y so SVG-down becomes screen-down.
  return new THREE.Vector3(x, -y, 0);
}

function fromWorld(v: THREE.Vector3) {
  return { x: v.x, y: -v.y };
}

function normalize2D(dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function getPipelineAbbreviation(pipelineName: string) {
  const matches = pipelineName.match(/\b([A-Za-z0-9])/g);
  return matches ? matches.join("").toUpperCase() : pipelineName;
}

function fitCameraToLayout(
  camera: THREE.PerspectiveCamera,
  controls: any,
  layout: GraphLayout,
) {
  const xs = layout.nodes.map((n) => n.x);
  const ys = layout.nodes.map((n) => -n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0);
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const maxSize = Math.max(sizeX, sizeY) || 1;

  // Heuristic distance that keeps the whole graph in view.
  const fov = (camera.fov * Math.PI) / 180;
  const distance = maxSize / 2 / Math.tan(fov / 2) + 200;

  camera.position.set(center.x, center.y, distance);
  camera.near = 0.1;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
}

function Scene({
  layout,
  appSettings,
  additionalColors,
  coordinateOverrides,
  saveCoordinateOverrides,
  onLassoBoxChange,
}: {
  layout: GraphLayout;
  appSettings: any;
  additionalColors: Record<string, string>;
  coordinateOverrides: CoordinateOverrides;
  saveCoordinateOverrides: (v: CoordinateOverrides) => void;
  onLassoBoxChange: (box: LassoBox) => void;
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const popupState = useAtomValue(issuePreviewPopupAtom);

  const [nodes, setNodes] = useState<RuntimeNode[]>(() => layout.nodes);
  const nodesById = useMemo(() => {
    const m = new Map<string, RuntimeNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [controlsEnabled, setControlsEnabled] = useState(true);

  const hoverPreviewRef = useRef<{
    timeout: number | null;
    nodeId: string | null;
    issue: GraphIssue | null;
    world: { x: number; y: number; z: number } | null;
    ctrlKey: boolean;
  }>({
    timeout: null,
    nodeId: null,
    issue: null,
    world: null,
    ctrlKey: false,
  });

  const draggingRef = useRef<{
    isDragging: boolean;
    pointerId: number | null;
    dragStartWorld: THREE.Vector3 | null;
    dragStartPositions: Map<string, { x: number; y: number }>;
    draggedIds: string[];
  }>({
    isDragging: false,
    pointerId: null,
    dragStartWorld: null,
    dragStartPositions: new Map(),
    draggedIds: [],
  });

  const dragCandidateRef = useRef<{
    pointerId: number;
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startWorld: THREE.Vector3;
    draggedIds: string[];
    dragStartPositions: Map<string, { x: number; y: number }>;
    didMove: boolean;
  } | null>(null);

  const lassoRef = useRef<{
    isLassoing: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }>({
    isLassoing: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  const layoutKey = useMemo(() => {
    const ids = layout.nodes.map((n) => n.id).join("|");
    return `${ids}|${layout.rectWidth}|${layout.rectHeight}|${layout.nodeWidth}|${layout.nodeHeight}`;
  }, [
    layout.nodes,
    layout.rectWidth,
    layout.rectHeight,
    layout.nodeWidth,
    layout.nodeHeight,
  ]);

  // Keep node positions in sync with latest computed layout/overrides (e.g. undo/redo),
  // but do NOT re-fit the camera when only coordinates move.
  useEffect(() => {
    if (draggingRef.current.isDragging || lassoRef.current.isLassoing) return;
    setNodes(layout.nodes);
  }, [layout.nodes]);

  // Reset interaction state and fit camera only when the graph structure/sizing changes.
  useEffect(() => {
    setHoveredId(null);
    setSelectedIds(new Set());
    setControlsEnabled(true);
    onLassoBoxChange({ x: 0, y: 0, w: 0, h: 0, visible: false });
    if (hoverPreviewRef.current.timeout) {
      window.clearTimeout(hoverPreviewRef.current.timeout);
      hoverPreviewRef.current.timeout = null;
    }
    // Initial camera fit (and on major layout/sizing changes)
    if ((camera as any).isPerspectiveCamera) {
      fitCameraToLayout(
        camera as THREE.PerspectiveCamera,
        controlsRef.current,
        layout,
      );
    }
  }, [layoutKey, camera, layout, onLassoBoxChange]);

  // Keep popup anchored to a world position.
  useFrame(() => {
    if (!popupState.issueData) return;
    if (!popupState.world) return;
    if (!popupState.isOpen && !popupState.isMeasuring) return;

    const rect = gl.domElement.getBoundingClientRect();
    const world = new THREE.Vector3(
      popupState.world.x,
      popupState.world.y,
      popupState.world.z,
    );
    const ndc = world.clone().project(camera as THREE.PerspectiveCamera);

    const anchorX = (ndc.x * 0.5 + 0.5) * rect.width + rect.left;
    const anchorY = (-ndc.y * 0.5 + 0.5) * rect.height + rect.top;

    const prev = popupState.anchor;
    if (
      prev &&
      Math.abs(prev.x - anchorX) < 0.5 &&
      Math.abs(prev.y - anchorY) < 0.5
    ) {
      return;
    }

    store.set(issuePreviewPopupAtom, {
      ...popupState,
      anchor: { x: anchorX, y: anchorY },
    });
  });

  const relatedSets = useMemo(() => {
    const parents = new Map<string, Set<string>>();
    const children = new Map<string, Set<string>>();
    layout.nodes.forEach((n) => {
      parents.set(n.id, new Set(n.data.parentIds || []));
    });
    layout.nodes.forEach((n) => {
      (n.data.parentIds || []).forEach((p) => {
        if (!children.has(p)) children.set(p, new Set());
        children.get(p)!.add(n.id);
      });
    });
    return { parents, children };
  }, [layout.nodes]);

  const isRelated = useMemo(() => {
    if (!hoveredId) return () => true;
    const hoveredParents = relatedSets.parents.get(hoveredId) || new Set();
    const hoveredChildren = relatedSets.children.get(hoveredId) || new Set();

    return (id: string) => {
      if (id === hoveredId) return true;
      if (hoveredParents.has(id)) return true;
      if (hoveredChildren.has(id)) return true;
      return false;
    };
  }, [hoveredId, relatedSets]);

  function beginNodeDragCandidate(e: ThreeEvent<PointerEvent>, nodeId: string) {
    e.stopPropagation();
    if (e.button !== 0) return;

    // Cancel any pending preview and hide current popup.
    if (hoverPreviewRef.current.timeout) {
      window.clearTimeout(hoverPreviewRef.current.timeout);
      hoverPreviewRef.current.timeout = null;
    }
    store.set(issuePreviewPopupAtom, {
      isOpen: false,
      issueData: null,
      position: { x: 0, y: 0 },
      isMeasuring: false,
      anchor: undefined,
      world: undefined,
      popupSize: undefined,
    });

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

    // Capture pointer on the canvas element.
    gl.domElement.setPointerCapture?.(e.pointerId);
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
      if (dist2 < threshold2) {
        return;
      }

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
      const next = prev.map((n) => {
        if (!draggingRef.current.draggedIds.includes(n.id)) return n;
        const base = draggingRef.current.dragStartPositions.get(n.id);
        if (!base) return n;
        const newWorld = toWorld(base.x, base.y).add(delta);
        const { x, y } = fromWorld(newWorld);
        return { ...n, x, y };
      });
      return next;
    });
  }

  function endNodePointer(e: ThreeEvent<PointerEvent>, node: RuntimeNode) {
    const cand = dragCandidateRef.current;
    if (!cand || cand.pointerId !== e.pointerId) {
      return;
    }
    e.stopPropagation();

    gl.domElement.releasePointerCapture?.(e.pointerId);

    // If a drag was started, finish it and persist overrides.
    if (
      draggingRef.current.isDragging &&
      draggingRef.current.pointerId === e.pointerId
    ) {
      const draggedIds = [...draggingRef.current.draggedIds];
      draggingRef.current.isDragging = false;
      setControlsEnabled(true);

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
      // No drag: treat as click -> open issue.
      window.open(node.data.htmlUrl, "_blank", "noopener,noreferrer");
    }

    dragCandidateRef.current = null;
  }

  function beginLasso(e: ThreeEvent<PointerEvent>) {
    // Shift+left-drag on background creates a lasso rectangle.
    // Normal left-drag remains OrbitControls rotate.
    if (e.button !== 0) return;
    if (!e.shiftKey) return;
    e.stopPropagation();

    // Don't lasso while dragging nodes.
    if (draggingRef.current.isDragging || dragCandidateRef.current) return;

    // Cancel any pending preview and hide current popup.
    if (hoverPreviewRef.current.timeout) {
      window.clearTimeout(hoverPreviewRef.current.timeout);
      hoverPreviewRef.current.timeout = null;
    }
    store.set(issuePreviewPopupAtom, {
      isOpen: false,
      issueData: null,
      position: { x: 0, y: 0 },
      isMeasuring: false,
      anchor: undefined,
      world: undefined,
      popupSize: undefined,
    });

    setControlsEnabled(false);

    lassoRef.current.isLassoing = true;
    lassoRef.current.pointerId = e.pointerId;
    lassoRef.current.startX = e.clientX;
    lassoRef.current.startY = e.clientY;
    lassoRef.current.x = e.clientX;
    lassoRef.current.y = e.clientY;
    lassoRef.current.w = 0;
    lassoRef.current.h = 0;

    onLassoBoxChange({ x: e.clientX, y: e.clientY, w: 0, h: 0, visible: true });
    gl.domElement.setPointerCapture?.(e.pointerId);
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
    gl.domElement.releasePointerCapture?.(e.pointerId);

    onLassoBoxChange({ x: 0, y: 0, w: 0, h: 0, visible: false });

    const { x, y, w, h } = lassoRef.current;
    if (w < 4 || h < 4) {
      // Tiny drag: treat as click clearing selection.
      setSelectedIds(new Set());
      return;
    }

    const rect = gl.domElement.getBoundingClientRect();
    const xMin = x - rect.left;
    const xMax = xMin + w;
    const yMin = y - rect.top;
    const yMax = yMin + h;

    const cam = camera as THREE.PerspectiveCamera;

    const nextSelected = new Set<string>();
    nodes.forEach((n) => {
      const world = toWorld(n.x, n.y);
      const ndc = world.clone().project(cam);
      const sx = (ndc.x * 0.5 + 0.5) * rect.width;
      const sy = (-ndc.y * 0.5 + 0.5) * rect.height;

      if (sx >= xMin && sx <= xMax && sy >= yMin && sy <= yMax) {
        nextSelected.add(n.id);
      }
    });

    setSelectedIds(nextSelected);
  }

  const planeSize = Math.max(layout.dagWidth, layout.dagHeight, 1000);

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[200, 200, 400]} intensity={0.8} />

      <OrbitControls
        ref={controlsRef}
        enabled={controlsEnabled}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        // With a 3D camera, keep orbit enabled.
      />

      {/* Background plane for pointer events (lasso) */}
      <mesh
        position={[0, 0, -1]}
        onPointerDown={beginLasso}
        onPointerMove={updateLasso}
        onPointerUp={endLasso}
      >
        <planeGeometry args={[planeSize * 4, planeSize * 4]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {appSettings.showGrid ? (
        <gridHelper
          args={[
            planeSize * 2,
            Math.max(2, Math.round((planeSize * 2) / layout.gridWidth)),
          ]}
          position={[0, 0, -0.5]}
        />
      ) : null}

      {/* Edges */}
      {layout.links.map((l) => {
        const source = nodesById.get(l.sourceId);
        const target = nodesById.get(l.targetId);
        if (!source || !target) return null;

        const [dx, dy] = getIntersection(
          source.x - target.x,
          source.y - target.y,
          target.x,
          target.y,
          (layout.rectWidth + layout.arrowSize / 3) / 2,
          (layout.rectHeight + layout.arrowSize / 3) / 2,
        );

        const pts = [toWorld(source.x, source.y), toWorld(dx, dy)];
        const hasValidPoints =
          pts.length >= 2 &&
          pts.every(
            (p) =>
              Number.isFinite(p.x) &&
              Number.isFinite(p.y) &&
              Number.isFinite(p.z),
          );
        if (!hasValidPoints) {
          return null;
        }

        const dirSvg = normalize2D(dx - source.x, dy - source.y);
        const dir = new THREE.Vector3(dirSvg.x, -dirSvg.y, 0);

        return (
          <React.Fragment key={`${l.sourceId}->${l.targetId}`}>
            <Line
              points={pts}
              lineWidth={2}
              color={l.arrowColor}
              transparent
              opacity={
                appSettings.highlightRelatedIssues && hoveredId
                  ? isRelated(l.sourceId) || isRelated(l.targetId)
                    ? 1
                    : 0.3
                  : 1
              }
            />
            <mesh
              position={toWorld(dx, dy)}
              rotation={(() => {
                const q = new THREE.Quaternion().setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  dir.normalize(),
                );
                const euler = new THREE.Euler().setFromQuaternion(q);
                return euler;
              })()}
            >
              <coneGeometry
                args={[layout.arrowSize / 10, layout.arrowSize / 6, 3]}
              />
              <meshStandardMaterial color={l.arrowColor} />
            </mesh>
          </React.Fragment>
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const pos = toWorld(n.x, n.y);
        const dimOther =
          appSettings.highlightRelatedIssues && hoveredId && !isRelated(n.id)
            ? 0.3
            : 1;
        const selected = selectedIds.has(n.id);

        return (
          <group
            key={n.id}
            position={pos}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (
                !draggingRef.current.isDragging &&
                !lassoRef.current.isLassoing
              ) {
                setHoveredId(n.id);
              }

              hoverPreviewRef.current.nodeId = n.id;
              hoverPreviewRef.current.issue = n.data;
              hoverPreviewRef.current.world = {
                x: pos.x,
                y: pos.y,
                z: pos.z,
              };
              hoverPreviewRef.current.ctrlKey = !!e.ctrlKey;

              if (hoverPreviewRef.current.timeout) {
                window.clearTimeout(hoverPreviewRef.current.timeout);
                hoverPreviewRef.current.timeout = null;
              }

              if (appSettings.showIssuePreviews && !e.ctrlKey) {
                hoverPreviewRef.current.timeout = window.setTimeout(() => {
                  if (
                    draggingRef.current.isDragging ||
                    lassoRef.current.isLassoing ||
                    hoverPreviewRef.current.nodeId !== n.id
                  ) {
                    return;
                  }

                  const issueData = {
                    id: n.data.id,
                    title: n.data.title,
                    body: n.data.body || "",
                    htmlUrl: n.data.htmlUrl,
                    assignees: n.data.assignees || [],
                    estimate: n.data.estimate,
                    pipelineName: n.data.pipelineName,
                  };

                  const rect = gl.domElement.getBoundingClientRect();
                  const w = hoverPreviewRef.current.world;
                  if (!w) return;
                  const world = new THREE.Vector3(w.x, w.y, w.z);
                  const ndc = world
                    .clone()
                    .project(camera as THREE.PerspectiveCamera);
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
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              if (
                !draggingRef.current.isDragging &&
                !lassoRef.current.isLassoing
              ) {
                setHoveredId((curr) => (curr === n.id ? null : curr));
              }

              if (hoverPreviewRef.current.timeout) {
                window.clearTimeout(hoverPreviewRef.current.timeout);
                hoverPreviewRef.current.timeout = null;
              }
              hoverPreviewRef.current.nodeId = null;
              hoverPreviewRef.current.issue = null;
              hoverPreviewRef.current.world = null;
            }}
            onPointerDown={(e) => beginNodeDragCandidate(e, n.id)}
            onPointerMove={updateNodePointer}
            onPointerUp={(e) => endNodePointer(e, n)}
          >
            {/* Selected sprint outline */}
            {n.data.isChosenSprint ? (
              <mesh>
                <boxGeometry
                  args={[layout.rectWidth + 4, layout.rectHeight + 4, 1]}
                />
                <meshStandardMaterial
                  color={additionalColors["Selected sprint"]}
                />
              </mesh>
            ) : null}

            <mesh>
              <boxGeometry args={[layout.rectWidth, layout.rectHeight, 2]} />
              <meshStandardMaterial
                color={n.color}
                transparent
                opacity={(n.opacity || 1) * dimOther}
              />
            </mesh>

            {/* Selected border */}
            {selected ? (
              <mesh position={[0, 0, 2]}>
                <boxGeometry
                  args={[layout.rectWidth + 2, layout.rectHeight + 2, 0.5]}
                />
                <meshBasicMaterial color="#2378ae" wireframe />
              </mesh>
            ) : null}

            {/* Labels */}
            <Text
              position={[0, 0, 3]}
              fontSize={14}
              color="black"
              anchorX="center"
              anchorY="middle"
            >
              {n.data.id}
            </Text>

            {appSettings.showIssueDetails ? (
              <Text
                position={[0, -layout.rectHeight / 2 + 10, 3]}
                fontSize={5}
                color="black"
                anchorX="center"
                anchorY="middle"
                maxWidth={layout.rectWidth - 6}
              >
                {n.data.title}
              </Text>
            ) : null}

            {/* bottom row */}
            <Text
              position={[0, layout.rectHeight / 2 - 8, 3]}
              fontSize={6}
              color="black"
              anchorX="center"
              anchorY="middle"
            >
              {`${getPipelineAbbreviation(n.data.pipelineName)}${
                appSettings.showIssueEstimates && n.data.estimate
                  ? `  ${n.data.estimate}`
                  : ""
              }${n.data.isNonEpicIssue ? "  External" : ""}`}
            </Text>
          </group>
        );
      })}

      {/* Lasso overlay is rendered by GraphCanvas (ReactDOM) */}
    </>
  );
}

export default function GraphCanvas(props: GraphCanvasProps) {
  const {
    graphData,
    appSettings,
    pipelineColors,
    additionalColors,
    coordinateOverrides,
    saveCoordinateOverrides,
    setCurrentGraphData,
  } = props;

  useEffect(() => {
    setCurrentGraphData(graphData);
  }, [graphData, setCurrentGraphData]);

  const layout = useMemo(() => {
    return computeGraphLayout(graphData, {
      appSettings,
      pipelineColors,
      coordinateOverrides,
    });
  }, [graphData, appSettings, pipelineColors, coordinateOverrides]);

  const [lassoBox, setLassoBox] = useState<LassoBox>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    visible: false,
  });

  if (!graphData?.length) {
    return <ChakraText padding="20px">No graph data.</ChakraText>;
  }

  return (
    <>
      <Canvas
        id="zdg-graph"
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          // Use a transparent clear so exports can optionally add a background.
          gl.setClearColor(new THREE.Color("#ffffff"), 0);
        }}
        camera={{ fov: 45, near: 0.1, far: 100000, position: [0, 0, 800] }}
      >
        <Scene
          layout={layout}
          appSettings={appSettings}
          additionalColors={additionalColors}
          coordinateOverrides={coordinateOverrides}
          saveCoordinateOverrides={saveCoordinateOverrides}
          onLassoBoxChange={setLassoBox}
        />
      </Canvas>
      {lassoBox.visible ? (
        <div
          style={{
            position: "fixed",
            left: `${lassoBox.x}px`,
            top: `${lassoBox.y}px`,
            width: `${lassoBox.w}px`,
            height: `${lassoBox.h}px`,
            border: "1px dashed #2378ae",
            borderRadius: "6px",
            zIndex: 999,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </>
  );
}
