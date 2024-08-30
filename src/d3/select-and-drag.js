import * as d3 from "d3";
import { drag as d3Drag } from "d3-drag";

import {
  getArrowEndColor,
  getIntersection,
  getNodeColor,
  roundToGrid,
  toFixedDecimalPlaces,
} from "./utils";

const outlineColor = "#2378ae";

function findIssuesAtTarget(roots, currentIssueId, x, y) {
  const issues = [];

  roots.forEach((root) => {
    if (root.x === x && root.y === y && root.data.id !== currentIssueId) {
      issues.push(root);
    }

    root.dataChildren.forEach((dataChild) => {
      const { child } = dataChild;

      if (child.x === x && child.y === y && child.data.id !== currentIssueId) {
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

export function setupSelectAndDrag(
  {
    arrowSize,
    colorMap,
    dag,
    dagWidth,
    defs,
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
  appSettings
) {
  const { snapToGrid } = appSettings;

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
            .attr("stroke", outlineColor)
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
            .attr("stop-color", getNodeColor(source, pipelineColors, colorMap));
          grad
            .select("stop:nth-child(2)")
            .attr("offset", "100%")
            .attr(
              "stop-color",
              getArrowEndColor(source, target, pipelineColors, colorMap)
            );

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
          return getArrowEndColor(source, target, pipelineColors, colorMap);
        });
    }

    function ended(event, d) {
      totalDx += event.dx;
      totalDy += event.dy;

      const newCoords = {};

      draggingNodes.each(function (d) {
        const node = d3.select(this);

        // Round to 1 decimal place to cut down on space when persisting the values.
        let newX = toFixedDecimalPlaces(d.x + totalDx, 1);
        let newY = toFixedDecimalPlaces(d.y + totalDy, 1);

        if (snapToGrid) {
          [newX, newY] = roundToGrid(nodeWidth, nodeHeight, newX, newY);
        }

        node.classed("dragging", false);

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
        // If alt or shift is pressed, pan instead of lassoo.
        // Pan will also work if the drag is started with the ctrl key pressed due to the default filter in d3-drag.
        if (startEvent.sourceEvent.altKey || startEvent.sourceEvent.shiftKey) {
          startEvent.on("drag", (dragEvent) => {
            if (
              startEvent.sourceEvent.altKey ||
              startEvent.sourceEvent.shiftKey
            ) {
              panZoom.instance.panBy({ x: dragEvent.dx, y: dragEvent.dy });
              return;
            }
          });

          return;
        }

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
          .attr("stroke", outlineColor)
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
}
