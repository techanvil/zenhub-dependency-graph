import React, { useMemo } from "react";
import * as THREE from "three";
import { useAtomValue } from "jotai";

import { GraphLayout, LayoutLink } from "../../graph/layout";
import { getIntersection } from "../../d3/utils";
import { RuntimeNode } from "./types";
import { toWorld, normalize2D } from "./utils";
import { appSettingsAtom } from "../../store/atoms";

function GradientTube({
  start,
  end,
  startColor,
  endColor,
  opacity,
  radius = 0.7,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  startColor: string;
  endColor: string;
  opacity: number;
  radius?: number;
}) {
  const geometry = useMemo(() => {
    // Use a tube mesh for real thickness (THREE.Line linewidth isn't supported
    // by most WebGL implementations). We add per-vertex colors so the gradient
    // matches the old 2D look.
    const curve = new THREE.LineCurve3(start, end);
    const g = new THREE.TubeGeometry(curve, 20, radius, 8, false);

    const c0 = new THREE.Color(startColor);
    const c1 = new THREE.Color(endColor);

    const dir = new THREE.Vector3().subVectors(end, start);
    const len2 = Math.max(1e-6, dir.lengthSq());

    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const t = THREE.MathUtils.clamp(v.sub(start).dot(dir) / len2, 0, 1);
      const c = c0.clone().lerp(c1, t);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [
    start.x,
    start.y,
    start.z,
    end.x,
    end.y,
    end.z,
    startColor,
    endColor,
    radius,
  ]);

  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
    });
    m.depthWrite = false;
    // Edges should never occlude node text; force them into the "background"
    // regardless of camera angle / transparency sorting.
    m.depthTest = false;
    m.toneMapped = false;
    return m;
  }, [opacity]);

  return <mesh geometry={geometry} material={material} renderOrder={0} />;
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

  const sourceColor = source.color || link.sourceColor || link.arrowColor;
  const targetColor = target.color || link.targetColor || link.arrowColor;
  const opacity =
    appSettings.highlightRelatedIssues && hoveredId
      ? isRelated(link.sourceId) || isRelated(link.targetId)
        ? 1
        : 0.3
      : 1;

  const tubeRadius = Math.max(0.4, layout.arrowSize / 45);

  return (
    <React.Fragment key={`${link.sourceId}->${link.targetId}`}>
      <GradientTube
        start={pts[0]}
        end={pts[1]}
        startColor={sourceColor}
        endColor={targetColor}
        opacity={opacity}
        radius={tubeRadius}
      />
      <mesh
        position={toWorld(dx, dy, target.z)}
        renderOrder={0}
        rotation={(() => {
          const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.normalize(),
          );
          const euler = new THREE.Euler().setFromQuaternion(q);
          return euler;
        })()}
      >
        <coneGeometry args={[layout.arrowSize / 7, layout.arrowSize / 4, 3]} />
        <meshBasicMaterial
          color={targetColor}
          transparent
          opacity={opacity}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </React.Fragment>
  );
};

export default Edge;
