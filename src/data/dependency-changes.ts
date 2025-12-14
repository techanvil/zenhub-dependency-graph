import { createBlockage, deleteIssueDependency } from "./graph-data";
import { cloneGraphData } from "../utils/clone-graph-data";

type GraphNode = {
  id: string;
  parentIds?: string[];
  zenhubIssueId?: string;
  repositoryGhId?: number;
};

type Edge = { sourceId: string; targetId: string };

export type DependencyOp =
  | { kind: "create"; edge: Edge }
  | { kind: "delete"; edge: Edge }
  | {
      kind: "retarget";
      sourceId: string;
      oldTargetId: string;
      newTargetId: string;
    };

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function removeFromArray(arr: string[], value: string) {
  return arr.filter((v) => v !== value);
}

function edgeKey(e: Edge) {
  return `${e.sourceId}->${e.targetId}`;
}

function getEdges(graphData: GraphNode[]): Edge[] {
  const edges: Edge[] = [];
  graphData.forEach((node) => {
    (node.parentIds || []).forEach((sourceId) => {
      edges.push({ sourceId, targetId: node.id });
    });
  });
  return edges;
}

function buildNodeMap(graphData: GraphNode[]) {
  const map = new Map<string, GraphNode>();
  graphData.forEach((n) => map.set(n.id, n));
  return map;
}

export function computePendingDependencyOps(
  baseline: GraphNode[] | undefined,
  current: GraphNode[] | undefined,
): { ops: DependencyOp[]; creates: Edge[]; deletes: Edge[] } {
  if (!baseline?.length || !current?.length) {
    return { ops: [], creates: [], deletes: [] };
  }

  const baselineEdges = getEdges(baseline);
  const currentEdges = getEdges(current);

  const baselineSet = new Set(baselineEdges.map(edgeKey));
  const currentSet = new Set(currentEdges.map(edgeKey));

  const creates = currentEdges.filter((e) => !baselineSet.has(edgeKey(e)));
  const deletes = baselineEdges.filter((e) => !currentSet.has(edgeKey(e)));

  const createsBySource = new Map<string, Edge[]>();
  const deletesBySource = new Map<string, Edge[]>();

  creates.forEach((e) => {
    const list = createsBySource.get(e.sourceId) || [];
    list.push(e);
    createsBySource.set(e.sourceId, list);
  });
  deletes.forEach((e) => {
    const list = deletesBySource.get(e.sourceId) || [];
    list.push(e);
    deletesBySource.set(e.sourceId, list);
  });

  const retargets: DependencyOp[] = [];
  const usedCreateKeys = new Set<string>();
  const usedDeleteKeys = new Set<string>();

  // Pair retargets: for a given source, exactly one delete and one create.
  Array.from(
    new Set([
      ...Array.from(createsBySource.keys()),
      ...Array.from(deletesBySource.keys()),
    ]),
  ).forEach((sourceId) => {
    const cs = createsBySource.get(sourceId) || [];
    const ds = deletesBySource.get(sourceId) || [];
    if (cs.length === 1 && ds.length === 1) {
      const c = cs[0];
      const d = ds[0];
      retargets.push({
        kind: "retarget",
        sourceId,
        oldTargetId: d.targetId,
        newTargetId: c.targetId,
      });
      usedCreateKeys.add(edgeKey(c));
      usedDeleteKeys.add(edgeKey(d));
    }
  });

  const remainingCreates: DependencyOp[] = creates
    .filter((e) => !usedCreateKeys.has(edgeKey(e)))
    .map((edge) => ({ kind: "create", edge }));
  const remainingDeletes: DependencyOp[] = deletes
    .filter((e) => !usedDeleteKeys.has(edgeKey(e)))
    .map((edge) => ({ kind: "delete", edge }));

  // Apply order: retargets first (internally create-then-delete), then creates, then deletes.
  const ops = [...retargets, ...remainingCreates, ...remainingDeletes];

  return { ops, creates, deletes };
}

function applyEdgeToBaseline(baseline: GraphNode[], op: DependencyOp) {
  const next = cloneGraphData(baseline);

  if (op.kind === "create") {
    const target = next.find((n) => n.id === op.edge.targetId);
    if (!target) return next;
    target.parentIds = uniq([...(target.parentIds || []), op.edge.sourceId]);
    return next;
  }

  if (op.kind === "delete") {
    const target = next.find((n) => n.id === op.edge.targetId);
    if (!target) return next;
    target.parentIds = removeFromArray(
      target.parentIds || [],
      op.edge.sourceId,
    );
    return next;
  }

  // retarget
  const oldTarget = next.find((n) => n.id === op.oldTargetId);
  const newTarget = next.find((n) => n.id === op.newTargetId);
  if (oldTarget) {
    oldTarget.parentIds = removeFromArray(
      oldTarget.parentIds || [],
      op.sourceId,
    );
  }
  if (newTarget) {
    newTarget.parentIds = uniq([...(newTarget.parentIds || []), op.sourceId]);
  }
  return next;
}

export async function applyPendingDependencyOps({
  baseline,
  current,
  ops,
}: {
  baseline: GraphNode[];
  current: GraphNode[];
  ops: DependencyOp[];
}): Promise<{
  nextBaseline: GraphNode[];
  appliedCount: number;
  totalCount: number;
}> {
  const nodeMap = buildNodeMap(current);
  let nextBaseline = cloneGraphData(baseline);
  let appliedCount = 0;

  for (const op of ops) {
    try {
      if (op.kind === "create") {
        const blocking = nodeMap.get(op.edge.sourceId);
        const blocked = nodeMap.get(op.edge.targetId);
        if (!blocking?.zenhubIssueId || !blocked?.zenhubIssueId) {
          throw new Error("Missing zenhubIssueId for createBlockage");
        }
        await createBlockage({
          blockingZenhubIssueId: blocking.zenhubIssueId,
          blockedZenhubIssueId: blocked.zenhubIssueId,
        });
      } else if (op.kind === "delete") {
        const blocking = nodeMap.get(op.edge.sourceId);
        if (!blocking?.repositoryGhId) {
          throw new Error("Missing repositoryGhId for deleteIssueDependency");
        }
        await deleteIssueDependency({
          repositoryGhId: blocking.repositoryGhId,
          blockingIssueNumber: parseInt(op.edge.sourceId, 10),
          blockedIssueNumber: parseInt(op.edge.targetId, 10),
        });
      } else {
        const blocking = nodeMap.get(op.sourceId);
        const newBlocked = nodeMap.get(op.newTargetId);
        if (
          !blocking?.zenhubIssueId ||
          !blocking?.repositoryGhId ||
          !newBlocked?.zenhubIssueId
        ) {
          throw new Error("Missing ids for retarget persistence");
        }

        let createdNew = false;
        try {
          await createBlockage({
            blockingZenhubIssueId: blocking.zenhubIssueId,
            blockedZenhubIssueId: newBlocked.zenhubIssueId,
          });
          createdNew = true;

          await deleteIssueDependency({
            repositoryGhId: blocking.repositoryGhId,
            blockingIssueNumber: parseInt(op.sourceId, 10),
            blockedIssueNumber: parseInt(op.oldTargetId, 10),
          });
        } catch (err) {
          // Best-effort server compensation to avoid server/UI divergence.
          if (createdNew) {
            try {
              await deleteIssueDependency({
                repositoryGhId: blocking.repositoryGhId,
                blockingIssueNumber: parseInt(op.sourceId, 10),
                blockedIssueNumber: parseInt(op.newTargetId, 10),
              });
            } catch {
              // ignore compensation failures; surface original error
            }
          }
          throw err;
        }
      }

      nextBaseline = applyEdgeToBaseline(nextBaseline, op);
      appliedCount += 1;
    } catch (err: any) {
      const wrapped = Object.assign(
        new Error(err?.message || "Failed to apply dependency changes"),
        {
          nextBaseline,
          appliedCount,
          failedOp: op,
          totalCount: ops.length,
          cause: err,
        },
      );
      throw wrapped;
    }
  }

  return { nextBaseline, appliedCount, totalCount: ops.length };
}
