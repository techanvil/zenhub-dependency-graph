/**
 * External dependencies
 */
import * as d3 from "d3";
import { dagStratify, sugiyama, decrossOpt } from "d3-dag";
import { drag as d3Drag } from "d3-drag";

/**
 * Internal dependencies
 */
import { getRectDimensions } from "./utils";
import { renderDetailedIssues } from "./detailed-issues";
import { renderSimpleIssues } from "./simple-issues";

function getIntersection(dx, dy, cx, cy, w, h) {
  if (Math.abs(dy / dx) < h / w) {
    // Hit vertical edge of box1
    return [cx + (dx > 0 ? w : -w), cy + (dy * w) / Math.abs(dx)];
  } else {
    // Hit horizontal edge of box1
    return [cx + (dx * h) / Math.abs(dy), cy + (dy > 0 ? h : -h)];
  }
}

function isAncestorOfNode(nodeId, ancestorId, graphData) {
  const node = graphData.find(({ id }) => id === nodeId);

  if (!node) {
    return false;
  }

  const { parentIds } = node;

  return !!parentIds?.some((parentId) => {
    if (parentId === ancestorId) {
      return true;
    }

    return isAncestorOfNode(parentId, ancestorId, graphData);
  });
}

function removeAncestors(graphData) {
  graphData?.forEach((node) => {
    const { parentIds } = node;

    if (!(parentIds && parentIds.length > 1)) {
      return;
    }

    const ancestorParentIds = [];

    parentIds.forEach((parentId) => {
      parentIds.forEach((otherParentId) => {
        if (isAncestorOfNode(parentId, otherParentId, graphData)) {
          ancestorParentIds.push(otherParentId);
        }
      });
    });

    node.parentIds = node.parentIds.filter(
      (parentId) => !ancestorParentIds.includes(parentId)
    );
  });
}

export function removeNonEpicIssues(graphData) {
  const nonEpicIssues = graphData?.filter((node) => node.isNonEpicIssue);

  graphData?.forEach((node) => {
    const { parentIds } = node;

    if (!parentIds?.length) {
      return;
    }

    node.parentIds = node.parentIds.filter(
      (parentId) =>
        !nonEpicIssues.some((nonEpicIssue) => nonEpicIssue.id === parentId)
    );
  });

  // remove nonEpicIssues from graphData, mutating it:
  nonEpicIssues?.forEach((nonEpicIssue) => {
    const index = graphData.findIndex((node) => node.id === nonEpicIssue.id);

    if (index > -1) {
      graphData.splice(index, 1);
    }
  });

  return nonEpicIssues;
}

// Remove issues which have no parents and aren't the parent for any issues.
export function removeSelfContainedIssues(graphData) {
  const selfContainedIssues = graphData?.filter((node) => {
    if (node.parentIds?.length) {
      return false;
    }

    return !graphData?.some((otherNode) =>
      otherNode.parentIds?.includes(node.id)
    );
  });

  // remove selfContainedIssues from graphData, mutating it:
  selfContainedIssues?.forEach((selfContainedIssue) => {
    const index = graphData.findIndex(
      (node) => node.id === selfContainedIssue.id
    );

    if (index > -1) {
      graphData.splice(index, 1);
    }
  });

  return selfContainedIssues;
}

function findNonPipelineParents(node, graphData, pipelineName) {
  const nonPipelineParents = [];

  node.parentIds?.forEach((parentId) => {
    const parent = graphData.find((node) => node.id === parentId);

    if (!parent) {
      return;
    }

    if (parent.pipelineName === pipelineName) {
      nonPipelineParents.push(
        ...findNonPipelineParents(parent, graphData, pipelineName)
      );
    } else {
      nonPipelineParents.push(parent);
    }
  });

  return nonPipelineParents;
}

export function removePipelineIssues(graphData, pipelineName) {
  const pipelineIssues = graphData?.filter(
    (node) => node.pipelineName === pipelineName
  );

  const fullGraphData = [...graphData];

  // remove pipelineIssues from graphData, mutating it:
  pipelineIssues?.forEach((pipelineIssue) => {
    const index = graphData.findIndex((node) => node.id === pipelineIssue.id);

    if (index > -1) {
      graphData.splice(index, 1);
    }
  });

  pipelineIssues?.forEach((pipelineIssue) => {
    graphData?.forEach((node) => {
      if (node.parentIds?.includes(pipelineIssue.id)) {
        node.parentIds = node.parentIds.filter(
          (parentId) => parentId !== pipelineIssue.id
        );

        const nonPipelineParents = findNonPipelineParents(
          pipelineIssue,
          fullGraphData,
          pipelineName
        );

        nonPipelineParents.forEach((openParent) => {
          if (!node.parentIds.includes(openParent.id)) {
            node.parentIds.push(openParent.id);
          }
        });
      }
    });
  });

  return pipelineIssues;
}

const panZoom = {
  instance: null,
  resizeHandler: null,
  epic: null, // Maintain zoom state when re-rendering the same epic.
  state: null,
  hasInteracted: false,
};

export const generateGraph = (
  graphData,
  svgElement,
  {
    pipelineColors,
    additionalColors,
    epic,
    coordinateOverrides,
    saveCoordinateOverrides,
  },
  appSettings
) => {
  const { showAncestorDependencies, showIssueDetails } = appSettings;

  try {
    // TODO: Find a better fix for preventing pan/zoom state resetting on re-rendering the epic.
    // This feels pretty hacky.
    if (panZoom.instance && panZoom.epic === epic) {
      if (panZoom.hasInteracted) {
        panZoom.state = {
          pan: panZoom.instance.getPan(),
          zoom: panZoom.instance.getZoom(),
        };
      }
    } else {
      panZoom.state = null;
      panZoom.hasInteracted = false;
    }

    if (panZoom.instance) {
      panZoom.instance.setOnPan(null);
      panZoom.instance.setOnZoom(null);
      panZoom.instance.destroy();
      panZoom.instance = null;
      window.removeEventListener("resize", panZoom.resizeHandler);
    }
  } catch (err) {
    console.log("panZoomInstance destroy error", err);
  }
  d3.selectAll("svg > *").remove();

  if (!showAncestorDependencies) {
    removeAncestors(graphData);
  }

  if (!graphData?.length) {
    return;
  }

  const { rectWidth, rectHeight } = getRectDimensions(appSettings);

  const dag = dagStratify()(graphData);
  const nodeWidth = rectWidth * 1.5;
  const nodeHeight = rectHeight * 2;
  const arrowSize = nodeHeight / 2.0;
  let layout = sugiyama(); // base layout
  // FIXME: Improve check for smaller graphs. See
  // https://github.com/erikbrinkman/d3-dag/blob/949a079457f6295d2834b750b898c1e0b412b6f8/src/sugiyama/decross/opt.ts#L70-L90
  const maxGraphSizeToDecross = 20;
  if (graphData.length < maxGraphSizeToDecross) {
    layout = layout.decross(decrossOpt()); // minimize number of crossings
  }

  layout = layout.nodeSize((node) =>
    node === undefined ? [0, 0] : [nodeWidth, nodeHeight]
  ); // set node size instead of constraining to fit
  const { width, height } = layout(dag);

  function applyOverrides(roots, overrides) {
    roots.forEach((root) => {
      if (overrides[root.data.id]) {
        root.x = overrides[root.data.id].x;
        root.y = overrides[root.data.id].y;
      }

      root.dataChildren.forEach((dataChild) => {
        const { child } = dataChild;

        if (overrides[child.data.id]) {
          child.x = overrides[child.data.id].x;
          child.y = overrides[child.data.id].y;
        }
        // const points = [...dataChild.points];

        dataChild.points.length = 0;
        dataChild.points.push({ x: root.x, y: root.y });
        dataChild.points.push({ x: child.x, y: child.y });
        // dataChild.points.push(points[points.length - 1]);
        // if (overrides[child.data.id]) {
        //   child.x = overrides[child.data.id].x;
        //   child.y = overrides[child.data.id].y;
        // }
      });

      applyOverrides(
        root.dataChildren.map(({ child }) => child),
        overrides
      );
    });
  }

  if (Object.keys(coordinateOverrides[epic] || {}).length) {
    applyOverrides(dag.proots, coordinateOverrides[epic]);
  }

  const svgSelection = d3.select(svgElement);
  svgSelection.attr("viewBox", [0, 0, width, height].join(" "));
  const defs = svgSelection.append("defs"); // For gradients

  const steps = dag.size();
  const interp = d3.interpolateRainbow;
  const colorMap = new Map();
  for (const [i, node] of dag.descendants().entries()) {
    colorMap.set(node.data.id, interp(i / steps));
  }

  function getNodeColor(target) {
    return (
      pipelineColors[target.data.pipelineName] || colorMap.get(target.data.id)
    );
  }

  function getArrowEndColor(source, target) {
    if (!source.data.isNonEpicIssue && target.data.isNonEpicIssue) {
      return "tomato";
    }

    return getNodeColor(target);
  }

  // How to draw edges
  const line = d3
    .line()
    .curve(d3.curveCatmullRom)
    .x((d) => d.x)
    .y((d) => d.y);

  const links = dag.links();

  // Plot edges
  svgSelection
    .append("g")
    .selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .attr("d", ({ points }) => {
      const linePoints = [...points];
      const target = linePoints.pop();
      const prevPoint = linePoints[linePoints.length - 1];
      const [dx, dy] = getIntersection(
        prevPoint.x - target.x,
        prevPoint.y - target.y,
        target.x,
        target.y,
        (rectWidth + arrowSize / 3) / 2,
        (rectHeight + arrowSize / 3) / 2
      );
      return line([...linePoints, { x: dx, y: dy }]);
    })
    .attr("fill", "none")
    .attr("stroke-width", 3)
    .attr("stroke", ({ source, target }) => {
      const [dx, dy] = getIntersection(
        source.x - target.x,
        source.y - target.y,
        target.x,
        target.y,
        (rectWidth + arrowSize / 3) / 2,
        (rectHeight + arrowSize / 3) / 2
      );

      // encodeURIComponents for spaces, hope id doesn't have a `--` in it.
      // Prefix with an alpha character to avoid invalid CSS selectors.
      const gradId = encodeURIComponent(
        `s-${source.data.id}--${target.data.id}`
      );
      const grad = defs
        .append("linearGradient")
        .attr("id", gradId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", source.x)
        .attr("x2", dx)
        .attr("y1", source.y)
        .attr("y2", dy);
      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", getNodeColor(source));
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", getArrowEndColor(source, target));
      return `url(#${gradId})`;
    });

  // Select nodes
  const nodes = svgSelection
    .append("g")
    .selectAll("g")
    .data(dag.descendants())
    .enter()
    .append("g")
    .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);

  // Plot node outlines
  // nodes
  //   .append("rect")
  //   .attr("width", nodeWidth)
  //   .attr("height", nodeHeight)
  //   .attr("fill", "rgba(0,0,0,0)")
  //   .attr("x", -nodeWidth / 2)
  //   .attr("y", -nodeHeight / 2)
  //   .attr("stroke", "#2378ae")
  //   .attr("stroke-dasharray", "10,5")
  //   .attr("stroke-linecap", "butt")
  //   .attr("stroke-width", 1);

  // Plot node outlines for chosen sprint
  const borderRectWidth = rectWidth + 3;
  const borderRectHeight = rectHeight + 3;
  nodes
    .filter((d) => d.data.isChosenSprint)
    .append("rect")
    .attr("width", borderRectWidth)
    .attr("height", borderRectHeight)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("x", -borderRectWidth / 2)
    .attr("y", -borderRectHeight / 2)
    .attr("fill", additionalColors["Selected sprint"]);
  // .attr("fill", (n) => getNodeColor(n));

  // Plot node rects
  nodes
    .append("rect")
    .attr("width", rectWidth)
    .attr("height", rectHeight)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("x", -rectWidth / 2)
    .attr("y", -rectHeight / 2)
    .attr("fill", (n) => getNodeColor(n));

  // Draw arrows
  const arrow = d3.symbol().type(d3.symbolTriangle).size(arrowSize);
  svgSelection
    .append("g")
    .selectAll("path")
    .data(dag.links())
    .enter()
    .append("path")
    .attr("d", arrow)
    .attr("transform", ({ source, target, points }) => {
      const [end, start] = points.reverse();
      const rdx = start.x - end.x;
      const rdy = start.y - end.y;
      const [dx, dy] = getIntersection(
        start.x - end.x,
        start.y - end.y,
        end.x,
        end.y,
        (rectWidth + arrowSize / 3) / 2,
        (rectHeight + arrowSize / 3) / 2
      );
      // This is the angle of the last line segment
      const angle = (Math.atan2(-rdy, -rdx) * 180) / Math.PI + 90;
      return `translate(${dx}, ${dy}) rotate(${angle})`;
    })
    .attr("fill", ({ source, target }) => getArrowEndColor(source, target));

  if (showIssueDetails) {
    renderDetailedIssues(nodes, appSettings);
  } else {
    renderSimpleIssues(nodes, appSettings);
  }

  // Dragging
  function started(event) {
    const node = d3.select(this).classed("dragging", true);

    event.on("drag", dragged).on("end", ended);

    function dragged(event, d) {
      node
        .raise()
        // .attr("cx", (d.x = event.x))
        // .attr("cy", (d.y = event.y))
        .attr("transform", `translate(${event.x}, ${event.y})`);

      function getSourceAndTarget(l) {
        if (l.source === d) {
          return [{ ...l.source, x: event.x, y: event.y }, l.target];
        }

        return [l.source, { ...l.target, x: event.x, y: event.y }];
      }

      svgSelection
        .selectChild("g")
        .selectChild("g") // links
        .selectAll("path")
        .filter((l) => {
          return l.source === d || l.target === d;
        })
        .attr("d", (l) => {
          const [source, target] = getSourceAndTarget(l);

          const [dx, dy] = getIntersection(
            source.x - target.x,
            source.y - target.y,
            target.x,
            target.y,
            (rectWidth + arrowSize / 3) / 2,
            (rectHeight + arrowSize / 3) / 2
          );

          // Stroke is already defined so we can just update the gradient here.
          const grad = defs
            .select(
              `linearGradient#${encodeURIComponent(
                `s-${source.data.id}--${target.data.id}`
              )}`
            )
            .attr("x1", source.x)
            .attr("x2", dx)
            .attr("y1", source.y)
            .attr("y2", dy);
          grad
            .select("stop")
            .attr("offset", "0%")
            .attr("stop-color", getNodeColor(source));
          grad
            .select("stop:nth-child(2)")
            .attr("offset", "100%")
            .attr("stop-color", getArrowEndColor(source, target));

          return line([
            { x: source.x, y: source.y },
            { x: dx, y: dy },
          ]);
        });

      svgSelection
        .selectChild("g")
        .selectChild("g:nth-child(3)") // arrows
        .selectAll("path")
        .filter((l) => {
          return l.source === d || l.target === d;
        })
        .attr("transform", (l) => {
          const [start, end] = getSourceAndTarget(l);
          const rdx = start.x - end.x;
          const rdy = start.y - end.y;
          const [dx, dy] = getIntersection(
            start.x - end.x,
            start.y - end.y,
            end.x,
            end.y,
            (rectWidth + arrowSize / 3) / 2,
            (rectHeight + arrowSize / 3) / 2
          );
          // This is the angle of the last line segment
          const angle = (Math.atan2(-rdy, -rdx) * 180) / Math.PI + 90;
          return `translate(${dx}, ${dy}) rotate(${angle})`;
        })
        .attr("fill", (l) => {
          const [source, target] = getSourceAndTarget(l);
          return getArrowEndColor(source, target);
        });
    }

    function ended(event) {
      node.classed("dragging", false);
      // console.log("ended", event.x, d3.select(this).datum().data.id);
      saveCoordinateOverrides({
        ...coordinateOverrides,
        [epic]: {
          ...coordinateOverrides[epic],
          // TODO do we have a `d` arg?
          [d3.select(this).datum().data.id]: { x: event.x, y: event.y },
        },
      });
    }
  }

  const drag = d3Drag();
  nodes.call(drag.on("start", started));

  // FIXME: Adding this pan/zoom currently breaks clicking away from a dropdown to close it.
  // eslint-disable-next-line no-undef
  panZoom.instance = svgPanZoom("#zdg-graph", {
    zoomEnabled: true,
    controlIconsEnabled: true,
    fit: true,
    center: true,
    zoomScaleSensitivity: 0.4,
    onPan() {
      panZoom.hasInteracted = true;
    },
    onZoom() {
      panZoom.hasInteracted = true;
    },
  });

  panZoom.resizeHandler = window.addEventListener("resize", function () {
    panZoom.instance.resize();
    panZoom.instance.fit();
    panZoom.instance.center();
  });

  panZoom.epic = epic;

  if (panZoom.state) {
    panZoom.instance.zoom(panZoom.state.zoom);
    panZoom.instance.pan(panZoom.state.pan);
  }

  return svgSelection;
};
