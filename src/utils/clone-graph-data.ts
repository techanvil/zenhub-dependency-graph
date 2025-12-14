export type CloneableGraphNode = {
  parentIds?: unknown[] | null;
};

/**
 * Shallow-clone a graph data array, ensuring `parentIds` is also cloned
 * so downstream code can mutate `parentIds` without mutating the original.
 *
 * If `data` is not an array, it is returned as-is (mirrors prior callsites).
 */
export function cloneGraphData<T extends CloneableGraphNode>(data: T[]): T[];
export function cloneGraphData<T>(data: T): T;
export function cloneGraphData(data: any) {
  if (!Array.isArray(data)) return data;
  return data.map((n) => ({
    ...n,
    parentIds: Array.isArray(n?.parentIds) ? [...n.parentIds] : [],
  }));
}
