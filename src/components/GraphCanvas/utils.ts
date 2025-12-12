import * as THREE from "three";

export function toWorld(x: number, y: number, z: number = 0) {
  // Flip Y so SVG-down becomes screen-down.
  return new THREE.Vector3(x, -y, z);
}

export function fromWorld(v: THREE.Vector3) {
  return { x: v.x, y: -v.y, z: v.z };
}

export function normalize2D(dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
