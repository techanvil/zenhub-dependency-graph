import React from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

import type { GraphLayout } from "../../graph/layout";
import type { RuntimeNode } from "./types";

function getPipelineAbbreviation(pipelineName: string) {
  const matches = pipelineName.match(/\b([A-Za-z0-9])/g);
  return matches ? matches.join("").toUpperCase() : pipelineName;
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
  return (
    <group
      position={position}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Selected sprint outline */}
      {node.data.isChosenSprint ? (
        <mesh>
          <boxGeometry
            args={[layout.rectWidth + 4, layout.rectHeight + 4, 1]}
          />
          <meshStandardMaterial color={additionalColors["Selected sprint"]} />
        </mesh>
      ) : null}

      <mesh>
        <boxGeometry args={[layout.rectWidth, layout.rectHeight, 2]} />
        <meshStandardMaterial
          color={node.color}
          transparent
          opacity={(node.opacity || 1) * dimOpacity}
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
        {node.data.id}
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
          {node.data.title}
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
        {`${getPipelineAbbreviation(node.data.pipelineName)}${
          appSettings.showIssueEstimates && node.data.estimate
            ? `  ${node.data.estimate}`
            : ""
        }${node.data.isNonEpicIssue ? "  External" : ""}`}
      </Text>
    </group>
  );
};

export default IssueNode;
