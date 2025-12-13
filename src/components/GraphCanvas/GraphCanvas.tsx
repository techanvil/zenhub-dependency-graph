import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text as ChakraText } from "@chakra-ui/react";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useAtom, useAtomValue, useSetAtom } from "jotai";

import {
  computeGraphLayout,
  CoordinateOverrides,
  GraphIssue,
  GraphLayout,
} from "../../graph/layout";
import {
  appSettingsAtom,
  additionalColorsAtom,
  pipelineColorsAtom,
  coordinateOverridesAtom,
  issuePreviewPopupAtom,
  store,
  currentGraphDataAtom,
} from "../../store/atoms";
import { toWorld } from "./utils";
import { RuntimeNode } from "./types";
import Edge from "./Edge";
import IssueNode from "./IssueNode";
import {
  LassoBox,
  useDragAndLassoInteractions,
} from "./useDragAndLassoInteractions";

type GraphCanvasProps = {
  graphData: GraphIssue[];
  appSettings: any;
  pipelineColors: Record<string, string>;
  additionalColors: Record<string, string>;
  coordinateOverrides: CoordinateOverrides;
  saveCoordinateOverrides: (v: CoordinateOverrides) => void;
  setCurrentGraphData: (v: any) => void;
};

const HIDDEN_ISSUE_POPUP_STATE = {
  isOpen: false,
  issueData: null,
  position: { x: 0, y: 0 },
  isMeasuring: false,
  anchor: undefined,
  world: undefined,
  popupSize: undefined,
} as const;

function fitCameraToLayout(
  camera: THREE.PerspectiveCamera,
  controls: any,
  layout: GraphLayout,
) {
  const xs = layout.nodes.map((n) => n.x);
  const ys = layout.nodes.map((n) => -n.y);
  const zs = layout.nodes.map((n: any) => (typeof n.z === "number" ? n.z : 0));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  const center = new THREE.Vector3(
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  );
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const maxSize = Math.max(sizeX, sizeY, sizeZ * 1.5) || 1;

  // Heuristic distance that keeps the whole graph in view.
  const fov = (camera.fov * Math.PI) / 180;
  const distance = maxSize / 2 / Math.tan(fov / 2) + 200;

  camera.position.set(center.x, center.y, center.z + distance);
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

  const cancelHoverPreview = () => {
    if (hoverPreviewRef.current.timeout) {
      window.clearTimeout(hoverPreviewRef.current.timeout);
      hoverPreviewRef.current.timeout = null;
    }
  };

  const hideIssuePopup = () => {
    store.set(issuePreviewPopupAtom, HIDDEN_ISSUE_POPUP_STATE);
  };

  const {
    selectedIds,
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
  } = useDragAndLassoInteractions({
    camera,
    domElement: gl.domElement,
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
    openIssue: (url) => window.open(url, "_blank", "noopener,noreferrer"),
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

  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Keep node positions in sync with latest computed layout/overrides (e.g. undo/redo),
  // but do NOT re-fit the camera when only coordinates move.
  useEffect(() => {
    if (draggingRef.current.isDragging || lassoRef.current.isLassoing) return;
    setNodes(layout.nodes);
  }, [layout.nodes]);

  // Reset interaction state and fit camera only when the graph structure/sizing changes.
  useEffect(() => {
    setHoveredId(null);
    resetInteractions();
    cancelHoverPreview();
    // Initial camera fit (and on major layout/sizing changes)
    if ((camera as any).isPerspectiveCamera) {
      fitCameraToLayout(
        camera as THREE.PerspectiveCamera,
        controlsRef.current,
        layoutRef.current,
      );
    }
    // NOTE: Do not depend on `layout` identity here — coordinate changes
    // (drag/drop overrides) create a new layout object and would refit the camera.
  }, [layoutKey, camera, onLassoBoxChange]);

  // Ensure the underlying OrbitControls instance picks up damping changes immediately.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.enableDamping = dampingEnabled;
    controls.dampingFactor = 0.08;
    controls.update?.();
  }, [dampingEnabled]);

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

  const planeSize = Math.max(layout.dagWidth, layout.dagHeight, 1000);

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[200, 200, 400]} intensity={0.8} />

      <OrbitControls
        ref={controlsRef}
        enabled={controlsEnabled}
        enableDamping={dampingEnabled}
        dampingFactor={0.08}
        enablePan
        enableZoom
        // With a 3D camera, keep orbit enabled.
        onStart={() => {
          // Re-enable damping for normal orbit usage.
          if (!draggingRef.current.isDragging && !lassoRef.current.isLassoing) {
            setDampingEnabled(true);
          }
        }}
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
      {layout.links.map((l) => (
        <Edge
          key={l.sourceId + ":" + l.targetId}
          link={l}
          layout={layout}
          nodesById={nodesById}
          isRelated={isRelated}
          hoveredId={hoveredId}
        />
      ))}

      {/* Nodes */}
      {nodes.map((n) => {
        const pos = toWorld(n.x, n.y, n.z);
        const dimOther =
          appSettings.highlightRelatedIssues && hoveredId && !isRelated(n.id)
            ? 0.3
            : 1;
        const selected = selectedIds.has(n.id);

        return (
          <IssueNode
            key={n.id}
            node={n}
            position={pos}
            layout={layout}
            appSettings={appSettings}
            additionalColors={additionalColors}
            dimOpacity={dimOther}
            selected={selected}
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
              hoverPreviewRef.current.world = { x: pos.x, y: pos.y, z: pos.z };
              hoverPreviewRef.current.ctrlKey = !!e.ctrlKey;

              cancelHoverPreview();

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

              cancelHoverPreview();
              hoverPreviewRef.current.nodeId = null;
              hoverPreviewRef.current.issue = null;
              hoverPreviewRef.current.world = null;
            }}
            onPointerDown={(e) => beginNodeDragCandidate(e, n.id)}
            onPointerMove={updateNodePointer}
            onPointerUp={(e) => endNodePointer(e, n)}
          />
        );
      })}

      {/* Lasso overlay is rendered by GraphCanvas (ReactDOM) */}
    </>
  );
}

export default function GraphCanvas(props: GraphCanvasProps) {
  const { graphData } = props;

  const setCurrentGraphData = useSetAtom(currentGraphDataAtom);

  const appSettings = useAtomValue(appSettingsAtom);
  const pipelineColors = useAtomValue(pipelineColorsAtom);
  const additionalColors = useAtomValue(additionalColorsAtom);
  const [coordinateOverrides, saveCoordinateOverrides] = useAtom(
    coordinateOverridesAtom,
  );

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
