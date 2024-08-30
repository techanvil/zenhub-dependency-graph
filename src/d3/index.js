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

export function toFixedDecimalPlaces(value, decimalPlaces) {
  return Number(
    Math.round(parseFloat(value + "e" + decimalPlaces)) + "e-" + decimalPlaces
  );
}

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

function roundToGrid(nodeWidth, nodeHeight, x, y) {
  let newX = x - nodeWidth / 2;
  let newY = y - nodeHeight / 2;

  newX = Math.round(newX / nodeWidth) * nodeWidth + nodeWidth / 2;
  newY = Math.round(newY / nodeHeight) * nodeHeight + nodeHeight / 2;

  return [newX, newY];
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
    setCurrentGraphData,
  },
  appSettings
) => {
  const { snapToGrid, showIssueDetails, showAncestorDependencies } =
    appSettings;

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
      try {
        panZoom.instance.setOnPan(null);
        panZoom.instance.setOnZoom(null);
        panZoom.instance.destroy();
      } catch (err) {
        // TODO: Fix the underlying cause of this error.
        console.log("panZoomInstance destroy error", err);
      }
      panZoom.instance = null;
      panZoom.resizeHandler?.disconnect();
    }
  } catch (err) {
    console.log("panZoomInstance destroy error", err);
  }
  d3.selectAll("svg > *").remove();

  if (!showAncestorDependencies) {
    removeAncestors(graphData);
  }

  setCurrentGraphData(graphData);

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
  const { width: dagWidth, height: dagHeight } = layout(dag);

  function getCoordinates({ x, y }) {
    if (snapToGrid) {
      return roundToGrid(nodeWidth, nodeHeight, x, y);
    }

    return [x, y];
  }

  function applyOverrides(roots, overrides) {
    roots.forEach((root) => {
      if (overrides[root.data.id]) {
        [root.x, root.y] = getCoordinates(overrides[root.data.id]);
      }

      root.dataChildren.forEach((dataChild) => {
        const { child } = dataChild;

        if (overrides[child.data.id]) {
          [child.x, child.y] = getCoordinates(overrides[child.data.id]);
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

  if (Object.keys(coordinateOverrides || {}).length) {
    applyOverrides(dag.proots || [dag], coordinateOverrides);
  }

  function getOverlaidIssueOpacities(dag) {
    function getCoordinateKeysToNodeData(roots, coordinateKeysToNodeData = {}) {
      roots.forEach((root) => {
        const coordinateKey = `${root.x},${root.y}`;

        coordinateKeysToNodeData[coordinateKey] =
          coordinateKeysToNodeData[coordinateKey] || [];

        if (!coordinateKeysToNodeData[coordinateKey].includes(root.data)) {
          coordinateKeysToNodeData[coordinateKey].push(root.data);
        }

        root.dataChildren?.forEach((dataChild) => {
          const { child } = dataChild;

          getCoordinateKeysToNodeData([child], coordinateKeysToNodeData);
        });
      });

      return coordinateKeysToNodeData;
    }

    const coordinateKeysToNodeData = getCoordinateKeysToNodeData(
      dag.proots || [dag]
    );

    return Object.entries(coordinateKeysToNodeData).reduce(
      (opacities, [coordinateKey, dataList]) => {
        if (dataList.length > 1) {
          const opacity = 1 / dataList.length;

          dataList.forEach((data) => {
            opacities[data.id] = opacity;
          });
        }

        return opacities;
      },
      {}
    );
  }

  const issueOpacities = getOverlaidIssueOpacities(dag);

  const svgSelection = d3.select(svgElement);
  svgSelection.attr("viewBox", [0, 0, dagWidth, dagHeight].join(" "));
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
    .attr("transform", ({ x, y }) => `translate(${x}, ${y})`)
    .attr("opacity", (d) => issueOpacities[d.data.id] || 1);

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
    .attr("class", "zdg-graph-arrows")
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

  function findIssuesAtTarget(roots, currentIssueId, x, y) {
    const issues = [];

    roots.forEach((root) => {
      if (root.x === x && root.y === y && root.data.id !== currentIssueId) {
        issues.push(root);
      }

      root.dataChildren.forEach((dataChild) => {
        const { child } = dataChild;

        if (
          child.x === x &&
          child.y === y &&
          child.data.id !== currentIssueId
        ) {
          issues.push(child);
        }
      });
    });

    return issues;
  }

  function getMinMaxNodeCoordinates(nodes) {
    let startX = Infinity,
      startY = Infinity,
      endX = -Infinity,
      endY = -Infinity;

    nodes.each((d) => {
      const { x, y } = d;

      startX = Math.min(startX, x);
      startY = Math.min(startY, y);
      endX = Math.max(endX, x);
      endY = Math.max(endY, y);
    });

    return { startX, startY, endX, endY };
  }

  let outlineSelection = null;

  // Dragging
  function started(event) {
    const isDraggingSelection =
      lassooedNodes && lassooedNodes.nodes().includes(this);

    const draggingNodes = isDraggingSelection ? lassooedNodes : d3.select(this);

    draggingNodes.classed("dragging", true);

    event.on("drag", dragged).on("end", ended);

    let totalDx = 0;
    let totalDy = 0;

    function dragged(event, draggedDatum) {
      totalDx += event.dx;
      totalDy += event.dy;

      const newCoordinatesByDataMap = new Map();

      draggingNodes.each(function (d) {
        const node = d3.select(this);

        // Round to 1 decimal place to cut down on space when persisting the values.
        const newX = toFixedDecimalPlaces(d.x + totalDx, 1);
        const newY = toFixedDecimalPlaces(d.y + totalDy, 1);

        newCoordinatesByDataMap.set(d, { x: newX, y: newY });

        node
          .raise()
          // .attr("cx", (d.x = newX))
          // .attr("cy", (d.y = event.y))
          .attr("transform", `translate(${newX}, ${newY})`);

        if (snapToGrid && !isDraggingSelection) {
          // Draw the dashed outline of the target node position.

          const [gridX, gridY] = roundToGrid(nodeWidth, nodeHeight, newX, newY);

          const issuesAtTarget = findIssuesAtTarget(
            dag.proots || [dag],
            d.data.id,
            gridX,
            gridY
          );

          const targetIssueHasOutline = issuesAtTarget.some(
            ({ data }) => data.isChosenSprint
          );

          const padding = targetIssueHasOutline ? 10 : 5;

          const borderRectWidth = rectWidth + padding;
          const borderRectHeight = rectHeight + padding;

          if (!outlineSelection) {
            const panZoomViewport = d3.select(".svg-pan-zoom_viewport");

            outlineSelection = panZoomViewport
              .insert("rect", "g")
              .attr("rx", 5)
              .attr("ry", 5);
          }

          outlineSelection
            // .attr("transform", `translate(${newX}, ${newY})`)
            .attr("width", borderRectWidth)
            .attr("height", borderRectHeight)
            .attr("x", gridX - borderRectWidth / 2)
            .attr("y", gridY - borderRectHeight / 2)
            .attr("stroke", "#2378ae")
            .attr("stroke-dasharray", "6,3")
            .attr("stroke-linecap", "butt")
            .attr("stroke-width", 1)
            .attr("fill", "rgba(0,0,0,0)");
        }
      });

      if (isDraggingSelection) {
        // Draw the dashed outline of the lassooed nodes.

        const newX = toFixedDecimalPlaces(draggedDatum.x + totalDx, 1);
        const newY = toFixedDecimalPlaces(draggedDatum.y + totalDy, 1);

        let deltaX;
        let deltaY;

        if (snapToGrid) {
          const [gridX, gridY] = roundToGrid(nodeWidth, nodeHeight, newX, newY);

          deltaX = gridX - draggedDatum.x;
          deltaY = gridY - draggedDatum.y;
        } else {
          deltaX = totalDx;
          deltaY = totalDy;
        }

        const { startX, startY } = getMinMaxNodeCoordinates(lassooedNodes);

        lassooSelection
          .attr("x", startX + deltaX - nodeWidth / 2)
          .attr("y", startY + deltaY - nodeHeight / 2);
      }

      // Update the lines and arrows.

      function getSourceAndTarget(l) {
        function getNewPathPoint(p) {
          const newCoords = newCoordinatesByDataMap.get(p);

          return newCoords ? { ...p, ...newCoords } : p;
        }

        return [getNewPathPoint(l.source), getNewPathPoint(l.target)];
      }

      svgSelection
        .selectChild("g")
        .selectChild("g") // links
        .selectAll("path")
        .filter((l) => {
          return (
            newCoordinatesByDataMap.has(l.source) ||
            newCoordinatesByDataMap.has(l.target)
          );
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
        .selectChild("g.zdg-graph-arrows") // arrows
        .selectAll("path")
        .filter((l) => {
          return (
            newCoordinatesByDataMap.has(l.source) ||
            newCoordinatesByDataMap.has(l.target)
          );
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

    function ended(event, d) {
      totalDx += event.dx;
      totalDy += event.dy;

      const newCoords = {};

      draggingNodes.each(function (d) {
        const node = d3.select(this);

        // Round to 1 decimal place to cut down on space when persisting the values.
        // let newX = toFixedDecimalPlaces(event.x, 1);
        // let newY = toFixedDecimalPlaces(event.y, 1);
        let newX = toFixedDecimalPlaces(d.x + totalDx, 1);
        let newY = toFixedDecimalPlaces(d.y + totalDy, 1);

        if (snapToGrid) {
          [newX, newY] = roundToGrid(nodeWidth, nodeHeight, newX, newY);
        }

        node.classed("dragging", false);
        // console.log("ended", newX, d3.select(this).datum().data.id);

        newCoords[d.data.id] = { x: newX, y: newY };
        // [d3.select(this).datum().data.id]: { x: newX, y: newY },
      });

      saveCoordinateOverrides({
        ...coordinateOverrides,
        ...newCoords,
      });
    }
  }

  const nodesDrag = d3Drag();
  const lassooDrag = d3Drag();

  nodes.call(nodesDrag.on("start", started));

  function getLassooedNodes(x, y, width, height) {
    return nodes.filter((d) => {
      const { x: nodeX, y: nodeY } = d;

      if (
        nodeX >= x &&
        nodeX <= x + width &&
        nodeY >= y &&
        nodeY <= y + height
      ) {
        return true;
      }

      return false;
    });
  }

  let lassooSelection = null;
  let lassooedNodes = null;

  svgSelection.call(
    lassooDrag
      // Setting the filter doesn't work but the default is to cancel if the ctrl key is pressed.
      // .filter((event) => {
      //   return !event.altKey;
      // })
      .on("start", (startEvent) => {
        if (!lassooSelection) {
          const panZoomViewport = d3.select(".svg-pan-zoom_viewport");

          lassooSelection = panZoomViewport
            .insert("rect", "g")
            .attr("rx", 5)
            .attr("ry", 5);
        }

        if (lassooedNodes) {
          lassooedNodes.classed("lassooed", false);
          lassooedNodes = null;
        }

        const pan = panZoom.instance.getPan();
        const zoom = panZoom.instance.getZoom();

        const svgRatio =
          document.getElementById("graph-container").getBoundingClientRect()
            .width / dagWidth;

        const newX = (startEvent.x - pan.x) / svgRatio / zoom;
        const newY = (startEvent.y - pan.y) / svgRatio / zoom;

        let width = 0,
          height = 0;

        lassooSelection
          .attr("width", width)
          .attr("height", height)
          .attr("x", newX)
          .attr("y", newY)
          .attr("stroke", "#2378ae")
          .attr("stroke-dasharray", "6,3")
          .attr("stroke-linecap", "butt")
          .attr("stroke-width", 1)
          .attr("fill", "rgba(0,0,0,0)");

        startEvent
          .on("drag", (dragEvent) => {
            width += dragEvent.dx / svgRatio / zoom;
            height += dragEvent.dy / svgRatio / zoom;

            lassooSelection.attr("width", width).attr("height", height);

            if (lassooedNodes) {
              lassooedNodes.classed("lassooed", false);
            }

            lassooedNodes = getLassooedNodes(newX, newY, width, height);
            lassooedNodes.classed("lassooed", true);

            // panZoom.instance.panBy({ x: event.dx, y: event.dy });
          })
          .on("end", (endEvent) => {
            if (!lassooedNodes) {
              return;
            }

            // lassooSelection.attr("width", 0).attr("height", 0);

            // Fit lassoo to nodes.
            const { startX, startY, endX, endY } =
              getMinMaxNodeCoordinates(lassooedNodes);

            lassooSelection
              .attr("width", endX - startX + nodeWidth)
              .attr("height", endY - startY + nodeHeight)
              .attr("x", startX - nodeWidth / 2)
              .attr("y", startY - nodeHeight / 2);
          });
      })
  );

  // nodes.call(drag.on("start", started));

  // const onStart = (event) => started(event);

  // FIXME: Adding this pan/zoom currently breaks clicking away from a dropdown to close it.
  if (typeof svgPanZoom === "function") {
    // eslint-disable-next-line no-undef
    panZoom.instance = svgPanZoom("#zdg-graph", {
      zoomEnabled: true,
      controlIconsEnabled: true,
      fit: true,
      center: true,
      zoomScaleSensitivity: 0.4,
      // eventsListenerElement: document.getElementById("graph-container"),
      onPan() {
        panZoom.hasInteracted = true;
      },
      onZoom() {
        panZoom.hasInteracted = true;
      },
    });

    panZoom.resizeHandler = new ResizeObserver(
      (() => {
        let prevWidth, prevHeight;

        return (entries) => {
          if (!(panZoom.instance || entries?.[0])) {
            return;
          }

          // Ensure the panZoom instance is only updated when the container size changes, as the ResizeObserver
          // can trigger for other reasons.

          const newWidth = entries[0].target.clientWidth;
          const newHeight = entries[0].target.clientHeight;

          if (prevWidth === undefined || prevHeight === undefined) {
            prevWidth = newWidth;
            prevHeight = newHeight;
            return;
          }

          if (newWidth === prevWidth && newHeight === prevHeight) {
            return;
          }

          prevWidth = newWidth;
          prevHeight = newHeight;

          try {
            panZoom.instance.resize();
            panZoom.instance.fit();
            panZoom.instance.center();
          } catch (err) {
            // TODO: Fix the underlying cause of this error.
            console.log("panZoom error on resize", err);
          }
        };
      })()
    ).observe(document.getElementById("graph-container"));

    panZoom.epic = epic;

    if (panZoom.state) {
      try {
        panZoom.instance.zoom(panZoom.state.zoom);
        panZoom.instance.pan(panZoom.state.pan);
      } catch (err) {
        // This is a safety net, the error should not occur.
        console.log("panZoom error on re-render", err);
      }
    }
  }

  return svgSelection;
};
