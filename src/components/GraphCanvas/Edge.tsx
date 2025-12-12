import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useAtomValue } from "jotai";

import { GraphLayout, LayoutLink } from "../../graph/layout";
import { getIntersection } from "../../d3/utils";
import { RuntimeNode } from "./types";
import { toWorld, normalize2D } from "./utils";
import { appSettingsAtom } from "../../store/atoms";

function GradientLine({
  start,
  end,
  startColor,
  endColor,
  opacity,
  lineWidth = 2,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  startColor: string;
  endColor: string;
  opacity: number;
  lineWidth?: number;
}) {
  // Use per-vertex colors on a BufferGeometry so the GPU interpolates the
  // gradient between the two endpoints (matching the approach in:
  // http://www.wayneparrott.com/how-to-create-three-js-gradient-colored-lines-and-circlelines-part-2/)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();

    const positions = new Float32Array([
      start.x,
      start.y,
      start.z,
      end.x,
      end.y,
      end.z,
    ]);

    const c0 = new THREE.Color(startColor);
    const c1 = new THREE.Color(endColor);
    const colors = new Float32Array([c0.r, c0.g, c0.b, c1.r, c1.g, c1.b]);

    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [start.x, start.y, start.z, end.x, end.y, end.z, startColor, endColor]);

  const material = useMemo(() => {
    const m = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      linewidth: lineWidth,
    });
    m.depthWrite = false;
    m.toneMapped = false;
    return m;
  }, [opacity, lineWidth]);

  const line = useMemo(
    () => new THREE.Line(geometry, material),
    [geometry, material],
  );

  useEffect(() => {
    return () => {
      line.removeFromParent();
      geometry.dispose();
      material.dispose();
    };
  }, [line, geometry, material]);

  return <primitive object={line} />;
}

type EdgeProps = {
  link: LayoutLink;
  layout: GraphLayout;
  nodesById: Map<string, RuntimeNode>;
  isRelated: (id: string) => boolean;
  hoveredId: string | null;
};

const Edge: React.FC<EdgeProps> = ({
  link,
  layout,
  nodesById,
  isRelated,
  hoveredId,
}) => {
  const appSettings = useAtomValue(appSettingsAtom);

  const source = nodesById.get(link.sourceId);
  const target = nodesById.get(link.targetId);
  if (!source || !target) return null;

  const [dx, dy] = getIntersection(
    source.x - target.x,
    source.y - target.y,
    target.x,
    target.y,
    (layout.rectWidth + layout.arrowSize / 3) / 2,
    (layout.rectHeight + layout.arrowSize / 3) / 2,
  );

  const pts = [
    toWorld(source.x, source.y, source.z),
    toWorld(dx, dy, target.z),
  ];
  const hasValidPoints =
    pts.length >= 2 &&
    pts.every(
      (p) =>
        Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
    );
  if (!hasValidPoints) {
    return null;
  }

  const dirSvg = normalize2D(dx - source.x, dy - source.y);
  const dir = new THREE.Vector3(dirSvg.x, -dirSvg.y, 0);

  // Render a gradient line by providing per-vertex colors (source -> target).
  // This matches the Three.js "vertexColors on geometry" approach:
  // http://www.wayneparrott.com/how-to-create-three-js-gradient-colored-lines-and-circlelines-part-2/
  const sourceColor = source.color || link.sourceColor || link.arrowColor;
  const targetColor = target.color || link.targetColor || link.arrowColor;

  return (
    <React.Fragment key={`${link.sourceId}->${link.targetId}`}>
      <GradientLine
        start={pts[0]}
        end={pts[1]}
        startColor={sourceColor}
        endColor={targetColor}
        opacity={
          appSettings.highlightRelatedIssues && hoveredId
            ? isRelated(link.sourceId) || isRelated(link.targetId)
              ? 1
              : 0.3
            : 1
        }
        lineWidth={2}
      />
      <mesh
        position={toWorld(dx, dy, target.z)}
        rotation={(() => {
          const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.normalize(),
          );
          const euler = new THREE.Euler().setFromQuaternion(q);
          return euler;
        })()}
      >
        <coneGeometry args={[layout.arrowSize / 10, layout.arrowSize / 6, 3]} />
        <meshStandardMaterial color={link.arrowColor} />
      </mesh>
    </React.Fragment>
  );
};

export default Edge;
