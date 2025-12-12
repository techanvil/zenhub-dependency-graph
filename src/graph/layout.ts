import * as d3 from "d3";
import { dagStratify, sugiyama, decrossOpt } from "d3-dag";

import {
  getArrowEndColor,
  getIntersection,
  getNodeColor,
  getRectDimensions,
  roundToGrid,
} from "../d3/utils";

export type GraphIssue = {
  id: string;
  title: string;
  body?: string;
  htmlUrl: string;
  assignees: string[];
  estimate?: string;
  pipelineName: string;
  parentIds: string[];
  sprints?: string[];
  isChosenSprint?: boolean;
  isNonEpicIssue?: boolean;
};

export type CoordinateOverrides = Record<string, { x: number; y: number }>;

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  opacity: number;
  color: string;
  data: GraphIssue;
};

export type LayoutLink = {
  sourceId: string;
  targetId: string;
  points: Array<{ x: number; y: number }>;
  sourceColor: string;
  targetColor: string;
  arrowColor: string;
  arrow: {
    x: number;
    y: number;
    dirX: number;
    dirY: number;
  };
};

export type GraphLayout = {
  nodes: LayoutNode[];
  links: LayoutLink[];
  dagWidth: number;
  dagHeight: number;
  rectWidth: number;
  rectHeight: number;
  nodeWidth: number;
  nodeHeight: number;
  gridWidth: number;
  gridHeight: number;
  arrowSize: number;
};

type AppSettings = {
  snapToGrid: boolean;
  showIssueDetails: boolean;
  showIssueSprints: boolean;
};

function normalize2D(dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function computeDepthFromAnchors(graphData: GraphIssue[]) {
  const ids = new Set(graphData.map((n) => n.id));
  const parentsById = new Map<string, string[]>();
  const childrenById = new Map<string, string[]>();

  // Init maps so `get()` is always safe.
  graphData.forEach((n) => {
    parentsById.set(n.id, []);
    childrenById.set(n.id, []);
  });

  // Build parent/child adjacency lists. `parentIds` are the blockers (parents).
  graphData.forEach((n) => {
    const parents = (n.parentIds || []).filter((p) => ids.has(p));
    parentsById.set(n.id, parents);
    parents.forEach((p) => {
      const arr = childrenById.get(p);
      if (arr) arr.push(n.id);
      else childrenById.set(p, [n.id]);
    });
  });

  // Anchors: issues that don't block any others => no children (out-degree = 0).
  const anchors = graphData
    .map((n) => n.id)
    .filter((id) => (childrenById.get(id)?.length || 0) === 0);

  // BFS from anchors backwards (anchor -> parents) yields shortest distance-to-anchor.
  const depthById: Record<string, number> = {};
  const queue: string[] = [];

  anchors.forEach((id) => {
    depthById[id] = 0;
    queue.push(id);
  });

  while (queue.length) {
    const id = queue.shift()!;
    const d = depthById[id] ?? 0;
    const parents = parentsById.get(id) || [];
    parents.forEach((p) => {
      const next = d + 1;
      const curr = depthById[p];
      if (curr === undefined || next < curr) {
        depthById[p] = next;
        queue.push(p);
      }
    });
  }

  // Any nodes not reached (shouldn't happen for a proper DAG) get depth 0.
  graphData.forEach((n) => {
    if (depthById[n.id] === undefined) depthById[n.id] = 0;
  });

  return { depthById, anchors };
}

export function computeGraphLayout(
  graphData: GraphIssue[],
  {
    appSettings,
    pipelineColors,
    coordinateOverrides,
  }: {
    appSettings: AppSettings;
    pipelineColors: Record<string, string>;
    coordinateOverrides?: CoordinateOverrides;
  },
): GraphLayout {
  const { snapToGrid } = appSettings;
  const { rectWidth, rectHeight } = getRectDimensions(appSettings);

  const dag = dagStratify()(graphData);

  const nodeWidth = rectWidth * 1.5;
  const nodeHeight = rectHeight * 2;
  const arrowSize = nodeHeight / 2.0;
  const zStep = nodeHeight * 0.9;

  // d3-dag's sugiyama typing gets unhappy when swapping decross operators;
  // keep this local operator as `any` to avoid fighting library generics.
  let layout: any = sugiyama();
  const maxGraphSizeToDecross = 20;
  if (graphData.length < maxGraphSizeToDecross) {
    layout = layout.decross(decrossOpt());
  }

  layout = layout.nodeSize((node: any) =>
    node === undefined ? [0, 0] : [nodeWidth, nodeHeight],
  );

  const { width: dagWidth, height: dagHeight } = layout(dag);

  const gridWidth = nodeWidth / 2;
  const gridHeight = nodeHeight / 2;

  function getCoordinates({ x, y }: { x: number; y: number }) {
    if (snapToGrid) {
      return roundToGrid(gridWidth, gridHeight, nodeWidth, nodeHeight, x, y);
    }

    return [x, y] as const;
  }

  function applyOverrides(roots: any[], overrides: CoordinateOverrides) {
    roots.forEach((root) => {
      if (overrides[root.data.id]) {
        [root.x, root.y] = getCoordinates(overrides[root.data.id]);
      }

      root.dataChildren.forEach((dataChild: any) => {
        const { child } = dataChild;

        if (overrides[child.data.id]) {
          [child.x, child.y] = getCoordinates(overrides[child.data.id]);
        }

        dataChild.points.length = 0;
        dataChild.points.push({ x: root.x, y: root.y });
        dataChild.points.push({ x: child.x, y: child.y });
      });

      applyOverrides(
        root.dataChildren.map(({ child }: any) => child),
        overrides,
      );
    });
  }

  if (coordinateOverrides && Object.keys(coordinateOverrides).length) {
    applyOverrides((dag as any).proots || [dag], coordinateOverrides);
  }

  function getOverlaidIssueOpacities(dagNode: any) {
    function getCoordinateKeysToNodeData(
      roots: any[],
      coordinateKeysToNodeData: Record<string, GraphIssue[]> = {},
    ) {
      roots.forEach((root) => {
        const coordinateKey = `${root.x},${root.y}`;

        coordinateKeysToNodeData[coordinateKey] =
          coordinateKeysToNodeData[coordinateKey] || [];

        if (!coordinateKeysToNodeData[coordinateKey].includes(root.data)) {
          coordinateKeysToNodeData[coordinateKey].push(root.data);
        }

        root.dataChildren?.forEach((dataChild: any) => {
          const { child } = dataChild;
          getCoordinateKeysToNodeData([child], coordinateKeysToNodeData);
        });
      });

      return coordinateKeysToNodeData;
    }

    const coordinateKeysToNodeData = getCoordinateKeysToNodeData(
      dagNode.proots || [dagNode],
    );

    return Object.entries(coordinateKeysToNodeData).reduce(
      (opacities, [, dataList]) => {
        if (dataList.length > 1) {
          const opacity = 1 / dataList.length;

          dataList.forEach((data) => {
            opacities[data.id] = opacity;
          });
        }

        return opacities;
      },
      {} as Record<string, number>,
    );
  }

  const issueOpacities = getOverlaidIssueOpacities(dag as any);

  const steps = dag.size();
  const interp = d3.interpolateRainbow;
  const colorMap = new Map<string, string>();
  for (const [i, node] of dag.descendants().entries()) {
    colorMap.set(node.data.id, interp(i / steps));
  }

  // Depth layering in Z: use anchors (issues with no children) as z=0,
  // and push their blockers "behind" them in Z.
  const { depthById } = computeDepthFromAnchors(graphData);

  const nodes: LayoutNode[] = dag.descendants().map((n: any) => ({
    id: n.data.id,
    x: n.x,
    y: n.y,
    z: -(depthById[n.data.id] || 0) * zStep,
    opacity: issueOpacities[n.data.id] || 1,
    color: getNodeColor(n, pipelineColors, colorMap),
    data: n.data as GraphIssue,
  }));

  const links: LayoutLink[] = dag.links().map((l: any) => {
    const source = l.source;
    const target = l.target;

    const [dx, dy] = getIntersection(
      source.x - target.x,
      source.y - target.y,
      target.x,
      target.y,
      (rectWidth + arrowSize / 3) / 2,
      (rectHeight + arrowSize / 3) / 2,
    );

    const sourceColor = getNodeColor(source, pipelineColors, colorMap);
    const targetColor = getNodeColor(target, pipelineColors, colorMap);
    const arrowColor = getArrowEndColor(
      source,
      target,
      pipelineColors,
      colorMap,
    );

    const dir = normalize2D(dx - source.x, dy - source.y);

    return {
      sourceId: source.data.id,
      targetId: target.data.id,
      points: [
        { x: source.x, y: source.y },
        { x: dx, y: dy },
      ],
      sourceColor,
      targetColor,
      arrowColor,
      arrow: {
        x: dx,
        y: dy,
        dirX: dir.x,
        dirY: dir.y,
      },
    };
  });

  return {
    nodes,
    links,
    dagWidth,
    dagHeight,
    rectWidth,
    rectHeight,
    nodeWidth,
    nodeHeight,
    gridWidth,
    gridHeight,
    arrowSize,
  };
}
