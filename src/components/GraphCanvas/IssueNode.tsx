import React, { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

import type { GraphLayout } from "../../graph/layout";
import type { RuntimeNode } from "./types";

function getPipelineAbbreviation(pipelineName: string) {
  const matches = pipelineName.match(/\b([A-Za-z0-9])/g);
  return matches ? matches.join("").toUpperCase() : pipelineName;
}

function getCombinedSprints(sprints?: string[]) {
  if (!sprints || sprints.length === 0) return "";
  return "Sprint " + sprints.map((s) => s.replace("Sprint ", "")).join(", ");
}

function makeRoundedRectExtrudeGeometry({
  width,
  height,
  radius,
  depth,
}: {
  width: number;
  height: number;
  radius: number;
  depth: number;
}) {
  const w = width;
  const h = height;
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));

  const x = -w / 2;
  const y = -h / 2;

  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: false,
  });

  // Center geometry around the node origin in Z.
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export type IssueNodeProps = {
  node: RuntimeNode;
  position: THREE.Vector3;
  layout: Pick<GraphLayout, "rectWidth" | "rectHeight">;
  appSettings: any;
  additionalColors: Record<string, string>;
  dimOpacity: number;
  selected: boolean;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
};

const IssueNode: React.FC<IssueNodeProps> = ({
  node,
  position,
  layout,
  appSettings,
  additionalColors,
  dimOpacity,
  selected,
  onPointerOver,
  onPointerOut,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  const opacity = (node.opacity || 1) * dimOpacity;

  // Match the older 2D style: rounded corners + flat/unlit colors.
  const cornerRadius = 6;
  const depth = 1;
  const borderPad = 3;

  const fillGeometry = useMemo(() => {
    return makeRoundedRectExtrudeGeometry({
      width: layout.rectWidth,
      height: layout.rectHeight,
      radius: cornerRadius,
      depth,
    });
  }, [layout.rectWidth, layout.rectHeight]);

  const borderGeometry = useMemo(() => {
    return makeRoundedRectExtrudeGeometry({
      width: layout.rectWidth + borderPad * 2,
      height: layout.rectHeight + borderPad * 2,
      radius: cornerRadius + borderPad,
      depth: depth * 0.8,
    });
  }, [layout.rectWidth, layout.rectHeight]);

  const borderColor = selected
    ? "#2378ae"
    : node.data.isChosenSprint
      ? additionalColors["Selected sprint"]
      : null;

  const sprintLabel =
    appSettings.showIssueSprints && node.data.sprints?.length
      ? getCombinedSprints(node.data.sprints)
      : "";

  const pipelineAbbrev = getPipelineAbbreviation(node.data.pipelineName);

  const padding = 4;
  const zText = 1.2;

  return (
    <group
      position={position}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Border (selected or chosen sprint) */}
      {borderColor ? (
        <mesh geometry={borderGeometry} position={[0, 0, -0.05]}>
          <meshBasicMaterial color={borderColor} toneMapped={false} />
        </mesh>
      ) : null}

      {/* Main card */}
      <mesh geometry={fillGeometry}>
        <meshBasicMaterial
          color={node.color}
          transparent
          opacity={opacity}
          toneMapped={false}
        />
      </mesh>

      {/* Top-left sprint label (2D-style) */}
      {sprintLabel ? (
        <Text
          position={[
            -layout.rectWidth / 2 + padding,
            layout.rectHeight / 2 - padding,
            zText,
          ]}
          fontSize={6}
          color="black"
          anchorX="left"
          anchorY="top"
        >
          {sprintLabel}
        </Text>
      ) : null}

      {/* Main issue id */}
      <Text
        position={[0, 0, zText]}
        fontSize={18}
        color="black"
        anchorX="center"
        anchorY="middle"
      >
        {node.data.id}
      </Text>

      {appSettings.showIssueDetails ? (
        <Text
          position={[0, -8, zText]}
          fontSize={5}
          color="black"
          anchorX="center"
          anchorY="top"
          maxWidth={layout.rectWidth - 6}
        >
          {node.data.title}
        </Text>
      ) : null}

      {/* Bottom-left estimate */}
      {appSettings.showIssueEstimates && node.data.estimate ? (
        <Text
          position={[
            -layout.rectWidth / 2 + padding,
            -layout.rectHeight / 2 + padding + 2,
            zText,
          ]}
          fontSize={6}
          color="black"
          anchorX="left"
          anchorY="bottom"
        >
          {node.data.estimate}
        </Text>
      ) : null}

      {/* Bottom-right pipeline abbreviation */}
      <Text
        position={[
          layout.rectWidth / 2 - padding,
          -layout.rectHeight / 2 + padding + 2,
          zText,
        ]}
        fontSize={6}
        color="black"
        anchorX="right"
        anchorY="bottom"
      >
        {`${pipelineAbbrev}${node.data.isNonEpicIssue ? "  External" : ""}`}
      </Text>
    </group>
  );
};

export default IssueNode;
