/**
 * External dependencies
 */
import * as d3 from "d3";
import { dagStratify, sugiyama, decrossOpt } from "d3-dag";

/**
 * Internal dependencies
 */
import {
  getArrowEndColor,
  getIntersection,
  getNodeColor,
  getRectDimensions,
  roundToGrid,
} from "./utils";
import { renderDetailedIssues } from "./detailed-issues";
import { renderSimpleIssues } from "./simple-issues";
import { selectAndDragState, setupSelectAndDrag } from "./select-and-drag";
import { store } from "../store/atoms";
import {
  showIssuePreviewPopupAtom,
  hideIssuePreviewPopupAtom,
} from "../store/atoms";
import { calculatePopupPosition } from "../utils/popup-position";

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
      (parentId) => !ancestorParentIds.includes(parentId),
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
        !nonEpicIssues.some((nonEpicIssue) => nonEpicIssue.id === parentId),
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
      otherNode.parentIds?.includes(node.id),
    );
  });

  // remove selfContainedIssues from graphData, mutating it:
  selfContainedIssues?.forEach((selfContainedIssue) => {
    const index = graphData.findIndex(
      (node) => node.id === selfContainedIssue.id,
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
        ...findNonPipelineParents(parent, graphData, pipelineName),
      );
    } else {
      nonPipelineParents.push(parent);
    }
  });

  return nonPipelineParents;
}

export function removePipelineIssues(graphData, pipelineName) {
  const pipelineIssues = graphData?.filter(
    (node) => node.pipelineName === pipelineName,
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
          (parentId) => parentId !== pipelineIssue.id,
        );

        const nonPipelineParents = findNonPipelineParents(
          pipelineIssue,
          fullGraphData,
          pipelineName,
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
    setCurrentGraphData,
  },
  appSettings,
) => {
  const {
    highlightRelatedIssues,
    snapToGrid,
    showGrid,
    showIssueDetails,
    showAncestorDependencies,
  } = appSettings;

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

        // TODO: This is a bit of a nuclear option, we should recover more gracefully.
        window.location.reload();
      }
      panZoom.instance = null;
      panZoom.resizeHandler?.disconnect();
    }
  } catch (err) {
    console.log("panZoomInstance destroy error", err);

    // TODO: This is a bit of a nuclear option, we should recover more gracefully.
    window.location.reload();
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
    node === undefined ? [0, 0] : [nodeWidth, nodeHeight],
  ); // set node size instead of constraining to fit
  const { width: dagWidth, height: dagHeight } = layout(dag);

  const gridWidth = nodeWidth / 2;
  const gridHeight = nodeHeight / 2;

  function getCoordinates({ x, y }) {
    if (snapToGrid) {
      return roundToGrid(gridWidth, gridHeight, nodeWidth, nodeHeight, x, y);
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
        overrides,
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
      dag.proots || [dag],
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
      {},
    );
  }

  const issueOpacities = getOverlaidIssueOpacities(dag);

  const svgSelection = d3.select(svgElement);
  svgSelection.attr("viewBox", [0, 0, dagWidth, dagHeight].join(" "));
  const defs = svgSelection.append("defs"); // For gradients

  // Add a full width/height rectangle to ensure svgPanZoom doesn't crop the viewport,
  // making it easier to determine the dimensions to use for lassoing.
  // TODO: See if there's a better way to handle this.
  const backgroundRect = svgSelection
    .append("rect")
    .attr("class", "zdg-background")
    .attr("width", dagWidth)
    .attr("height", dagHeight);

  if (showGrid) {
    // Append to defs using d3:
    //   <pattern id="smallGrid" width="8" height="8" patternUnits="userSpaceOnUse">
    //   <path d="M 8 0 L 0 0 0 8" fill="none" stroke="gray" stroke-width="0.5"/>
    // </pattern>
    defs
      .append("pattern")
      .attr("id", "smallGrid")
      .attr("width", gridWidth)
      .attr("height", gridHeight)
      .attr("patternUnits", "userSpaceOnUse")
      .append("path")
      .attr("d", `M ${gridWidth} 0 L 0 0 0 ${gridHeight}`) //"M 8 0 L 0 0 0 8")
      .attr("fill", "none")
      .attr("stroke", "gray")
      .attr("stroke-width", 0.5);

    backgroundRect.attr("fill", "url(#smallGrid)");
  } else {
    backgroundRect.attr("fill", "rgba(0,0,0,0)");
  }

  const steps = dag.size();
  const interp = d3.interpolateRainbow;
  const colorMap = new Map();
  for (const [i, node] of dag.descendants().entries()) {
    colorMap.set(node.data.id, interp(i / steps));
  }

  // How to draw edges
  const line = d3
    .line()
    .curve(d3.curveCatmullRom)
    .x((d) => d.x)
    .y((d) => d.y);

  const links = dag.links();

  // Plot edges
  const lines = svgSelection
    .append("g")
    .selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .attr("class", "zdg-line")
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
        (rectHeight + arrowSize / 3) / 2,
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
        (rectHeight + arrowSize / 3) / 2,
      );

      // encodeURIComponents for spaces, hope id doesn't have a `--` in it.
      // Prefix with an alpha character to avoid invalid CSS selectors.
      const gradId = encodeURIComponent(
        `s-${source.data.id}--${target.data.id}`,
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
        .attr("stop-color", getNodeColor(source, pipelineColors, colorMap));
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr(
          "stop-color",
          getArrowEndColor(source, target, pipelineColors, colorMap),
        );
      return `url(#${gradId})`;
    });

  // Select nodes
  const issues = svgSelection
    .append("g")
    .selectAll("g")
    .data(dag.descendants())
    .enter()
    .append("g")
    .attr("transform", ({ x, y }) => `translate(${x}, ${y})`)
    // Append a white background rect which retains full opacity to avoid showing lines through opaque nodes.
    // TODO: DRY the rect creation?
    .append("rect")
    .attr("width", rectWidth)
    .attr("height", rectHeight)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("x", -rectWidth / 2)
    .attr("y", -rectHeight / 2)
    .attr("fill", "white")
    .select(function () {
      return this.parentNode;
    })

    // Append the issue group element that will contain the issue details.
    .append("g")
    .attr("opacity", (d) => issueOpacities[d.data.id] || 1)
    .attr("class", "zdg-issue");

  const nodes = issues.select(function () {
    return this.parentNode;
  });

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
  issues
    .filter((d) => d.data.isChosenSprint)
    .append("rect")
    .attr("width", borderRectWidth)
    .attr("height", borderRectHeight)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("x", -borderRectWidth / 2)
    .attr("y", -borderRectHeight / 2)
    .attr("fill", additionalColors["Selected sprint"]);
  // .attr("fill", (n) => getNodeColor(n, pipelineColors, colorMap));

  // Plot node rects
  issues
    .append("rect")
    .attr("width", rectWidth)
    .attr("height", rectHeight)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("x", -rectWidth / 2)
    .attr("y", -rectHeight / 2)
    .attr("fill", (n) => getNodeColor(n, pipelineColors, colorMap));

  // Draw arrows
  const arrow = d3.symbol().type(d3.symbolTriangle).size(arrowSize);
  const arrows = svgSelection
    .append("g")
    .attr("class", "zdg-graph-arrows")
    .selectAll("path")
    .data(dag.links())
    .enter()
    .append("path")
    .attr("class", "zdg-arrow")
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
        (rectHeight + arrowSize / 3) / 2,
      );
      // This is the angle of the last line segment
      const angle = (Math.atan2(-rdy, -rdx) * 180) / Math.PI + 90;
      return `translate(${dx}, ${dy}) rotate(${angle})`;
    })
    .attr("fill", ({ source, target }) =>
      getArrowEndColor(source, target, pipelineColors, colorMap),
    );

  const showIssuePreviews = true;
  // Highlight blocked and blocking issues and/or show a preview of the related GH issue on hover.
  if (highlightRelatedIssues || showIssuePreviews) {
    let previewTimeout;

    nodes
      .on("mouseenter", (_e, d) => {
        const { data } = d;

        if (selectAndDragState.isLassooing) {
          return;
        }

        const { id, parentIds } = data;

        if (highlightRelatedIssues) {
          issues
            .filter(
              (d) =>
                id !== d.data.id &&
                !parentIds.includes(d.data.id) &&
                !d.data.parentIds.includes(id),
            )
            .attr("opacity", "0.3");

          lines
            .filter(
              ({ source, target }) =>
                source.data.id !== id && target.data.id !== id,
            )
            .attr("opacity", "0.3");

          arrows
            .filter(
              ({ source, target }) =>
                source.data.id !== id && target.data.id !== id,
            )
            .attr("opacity", "0.3");
        }

        if (showIssuePreviews) {
          const delay = highlightRelatedIssues ? 1000 : 0;
          previewTimeout = setTimeout(() => {
            // Show React popup preview of the related GH issue
            const issueData = {
              id: data.id,
              title: data.title,
              body: data.body || "",
              htmlUrl: data.htmlUrl,
              assignees: data.assignees || [],
              estimate: data.estimate,
              pipelineName: data.pipelineName,
              number: data.number,
            };

            const { x, y } = calculatePopupPosition(d.x, d.y, {
              svgElement,
              panZoomInstance: panZoom.instance,
              dagWidth,
              dagHeight,
            });

            store.set(showIssuePreviewPopupAtom, {
              issueData,
              x,
              y,
            });
          }, delay);
        }
      })
      .on("mouseleave", () => {
        if (selectAndDragState.isLassooing) {
          return;
        }

        if (highlightRelatedIssues) {
          issues.attr("opacity", (d) => issueOpacities[d.data.id] || 1);
          lines.attr("opacity", "1");
          arrows.attr("opacity", "1");
        }

        if (showIssuePreviews) {
          clearTimeout(previewTimeout);

          // Hide the React popup preview of the related GH issue
          store.set(hideIssuePreviewPopupAtom);
        }
      });
  }

  if (showIssueDetails) {
    renderDetailedIssues(issues, appSettings);
  } else {
    renderSimpleIssues(issues, appSettings);
  }

  setupSelectAndDrag(
    {
      arrowSize,
      colorMap,
      dag,
      dagHeight,
      dagWidth,
      defs,
      gridWidth,
      gridHeight,
      line,
      nodeHeight,
      nodes,
      nodeWidth,
      panZoom,
      pipelineColors,
      rectHeight,
      rectWidth,
      svgSelection,
      coordinateOverrides,
      saveCoordinateOverrides,
    },
    appSettings,
  );

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

    function restorePanZoomState() {
      try {
        panZoom.instance.zoom(panZoom.state.zoom);
        panZoom.instance.pan(panZoom.state.pan);
      } catch (err) {
        // This is a safety net, the error should not occur.
        console.log("panZoom error on re-render", err);

        // TODO: This is a bit of a nuclear option, we should recover more gracefully.
        window.location.reload();
      }
    }

    panZoom.resizeHandler = new ResizeObserver(
      (() => {
        let prevWidth, prevHeight;

        return (entries) => {
          if (!(panZoom.instance || entries?.[0])) {
            return;
          }

          // Ensure the panZoom instance is only updated when the container size changes, as the
          // handler is triggered when the observer is first connected.

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

          try {
            const pan = panZoom.instance.getPan();
            const zoom = panZoom.instance.getZoom();

            const ratio = newWidth / prevWidth;

            panZoom.state = {
              pan: {
                x: pan.x * ratio,
                y: pan.y * ratio,
              },
              zoom: zoom * ratio,
            };

            panZoom.instance.resize();
            panZoom.instance.fit();
            panZoom.instance.center();

            restorePanZoomState();
          } catch (err) {
            // TODO: Fix the underlying cause of this error.
            console.log("panZoom error on resize", err);

            // TODO: This is a bit of a nuclear option, we should recover more gracefully.
            window.location.reload();
          }

          prevWidth = newWidth;
          prevHeight = newHeight;
        };
      })(),
    );
    panZoom.resizeHandler.observe(document.getElementById("graph-container"));

    panZoom.epic = epic;

    if (panZoom.state) {
      restorePanZoomState();
    }
  }

  return svgSelection;
};
