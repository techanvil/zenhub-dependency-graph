import * as d3 from "d3";
import { drag as d3Drag } from "d3-drag";

import { getIntersection } from "./utils";

let globalListenersInstalled = false;
let activeController = null;

function getViewportNode(svgSelection) {
  return (
    document.querySelector(".svg-pan-zoom_viewport") ||
    svgSelection.node() ||
    document.documentElement
  );
}

function cloneGraphData(graphData) {
  return graphData.map((n) => ({
    ...n,
    parentIds: n.parentIds ? [...n.parentIds] : [],
  }));
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function removeFromArray(arr, value) {
  return arr.filter((v) => v !== value);
}

/**
 * Dependency edit interactions (in-memory only).
 *
 * - Ctrl + hover node: show an outgoing handle
 * - Drag handle from node A to node B: add dependency A -> B (B.parentIds += A.id)
 * - Ctrl + hover edge: show a target-end handle
 * - Drag edge handle to node C: retarget dependency A -> C (remove A from oldTarget.parentIds, add A to newTarget.parentIds)
 */
export function setupDependencyEdit({
  svgSelection,
  nodes,
  lines,
  rectWidth,
  rectHeight,
  arrowSize,
  graphData,
  rerender,
  isAncestorOfNode,
  selectAndDragState,
}) {
  const controller = {};
  activeController = controller;

  const handleRadius = 6;
  // Keep the handle touching the node to avoid a “dead gap” that breaks hover.
  const handleOffset = handleRadius;

  const state = {
    ctrlDown: false,
    hoveredNodeId: null,
    hoveredNodeEl: null,
    hoveredLink: null,
    dragging: false,
    edgeHandleDragging: false,
    dragSourceId: null,
    dragOriginalLink: null, // { sourceId, oldTargetId }
    dropTargetId: null,
    hiddenEdge: null, // { sourceId, targetId } for temporarily-hidden “current edge”
  };

  // --- Underlay/overlay ---
  // We want preview lines *behind* nodes, but handles *above* nodes.
  const firstNode = nodes.node();
  const nodesRoot = firstNode?.parentNode || null;
  const nodesRootParent = nodesRoot?.parentNode || svgSelection.node();

  const underlay = d3
    .select(nodesRootParent)
    .insert("g", () => nodesRoot)
    .attr("class", "zdg-edit-underlay");

  const overlay = svgSelection.append("g").attr("class", "zdg-edit-overlay");

  let dragline = null;
  let edgeHandle = null;
  let nodeDragHandle = null;
  let edgePreviewLine = null;
  let edgePreviewArrow = null;
  let edgeDeleteButton = null;

  function setEditModeClass(isOn) {
    svgSelection.classed("zdg-dependency-edit-mode", !!isOn);
  }

  function setRenderedEdgeHidden({ sourceId, targetId }, isHidden) {
    const vis = isHidden ? "hidden" : null;

    // Hide the actual rendered edge path.
    lines
      .filter(
        (l) =>
          l?.source?.data?.id === sourceId && l?.target?.data?.id === targetId,
      )
      .style("visibility", vis);

    // Hide the corresponding arrow head too (it’s rendered separately).
    svgSelection
      .selectAll(".zdg-graph-arrows path.zdg-arrow")
      .filter(
        (l) =>
          l?.source?.data?.id === sourceId && l?.target?.data?.id === targetId,
      )
      .style("visibility", vis);
  }

  function restoreHiddenEdge() {
    if (!state.hiddenEdge) return;
    setRenderedEdgeHidden(state.hiddenEdge, false);
    state.hiddenEdge = null;
  }

  function hideCurrentEdgeForLink(link) {
    const sourceId = link?.source?.data?.id;
    const targetId = link?.target?.data?.id;
    if (!sourceId || !targetId) return;

    // Only ever hide one at a time; restore any previous just in case.
    restoreHiddenEdge();
    state.hiddenEdge = { sourceId, targetId };
    setRenderedEdgeHidden(state.hiddenEdge, true);
  }

  function clearDropHover() {
    if (!state.dropTargetId) return;
    const el = nodeIdToEl.get(state.dropTargetId);
    if (el) d3.select(el).classed("zdg-dependency-drop-hover", false);
    state.dropTargetId = null;
  }

  function setDropHover(nodeId) {
    if (state.dropTargetId === nodeId) return;
    clearDropHover();
    if (!nodeId) return;
    const el = nodeIdToEl.get(nodeId);
    if (el) d3.select(el).classed("zdg-dependency-drop-hover", true);
    state.dropTargetId = nodeId;
  }

  function clearDragArtifacts() {
    restoreHiddenEdge();
    dragline?.remove();
    dragline = null;
    edgeHandle?.remove();
    edgeHandle = null;
    edgeDeleteButton?.remove();
    edgeDeleteButton = null;
    nodeDragHandle?.remove();
    nodeDragHandle = null;
    edgePreviewLine?.remove();
    edgePreviewLine = null;
    edgePreviewArrow?.remove();
    edgePreviewArrow = null;
    clearDropHover();
  }
  function getNodeBoundaryIntersection({ fromX, fromY, toX, toY }) {
    // Intersection point on the node rectangle boundary, moving from center toward (toX,toY).
    return getIntersection(
      toX - fromX,
      toY - fromY,
      fromX,
      fromY,
      rectWidth / 2,
      rectHeight / 2,
    );
  }

  function getPointerSvgXY(dragEvent) {
    const viewportNode = getViewportNode(svgSelection);
    const [x, y] = d3.pointer(dragEvent.sourceEvent, viewportNode);
    return { x, y };
  }

  // --- Node lookup / hit testing ---
  const nodeIdToEl = new Map();
  const nodeIdToDatum = new Map();

  nodes.each(function (d) {
    nodeIdToEl.set(d.data.id, this);
    nodeIdToDatum.set(d.data.id, d);
  });

  function snapshotLayoutOverrides() {
    // Capture the currently displayed node coordinates so dependency edits don't trigger a re-layout jump.
    // This is intentionally in-memory only.
    const overrides = {};
    nodeIdToDatum.forEach((d, id) => {
      overrides[id] = { x: d.x, y: d.y };
    });
    return overrides;
  }

  function findNodeAtPoint(x, y, { excludeId } = {}) {
    // Linear scan; graphs are typically small enough.
    // Prefer “top-most” by scanning in DOM order (later nodes drawn are later in the selection).
    const entries = Array.from(nodeIdToDatum.entries());
    for (let i = entries.length - 1; i >= 0; i--) {
      const [id, d] = entries[i];
      if (excludeId && id === excludeId) continue;
      const left = d.x - rectWidth / 2;
      const right = d.x + rectWidth / 2;
      const top = d.y - rectHeight / 2;
      const bottom = d.y + rectHeight / 2;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        return id;
      }
    }
    return null;
  }

  function canAddEdge({ sourceId, targetId, data }) {
    if (!sourceId || !targetId) return false;
    if (sourceId === targetId) return false;

    const target = data.find((n) => n.id === targetId);
    if (!target) return false;

    const parentIds = target.parentIds || [];
    if (parentIds.includes(sourceId)) return false;

    // Prevent cycles: disallow if target is already an ancestor of source.
    if (isAncestorOfNode?.(sourceId, targetId, data)) return false;

    return true;
  }

  // --- Node handle UI ---
  const nodeHandles = nodes
    .append("g")
    .attr("class", "zdg-dependency-handles")
    .attr("aria-hidden", "true");

  const nodeHandleCircle = nodeHandles
    .append("circle")
    .attr("class", "zdg-dependency-handle")
    .attr("r", handleRadius)
    // Place handle below the node (centered) for intuitive “drag down” affordance.
    .attr("cx", 0)
    .attr("cy", rectHeight / 2 + handleOffset);

  function updateNodeHandleVisibility() {
    // show/hide by toggling class on the hovered node element
    nodes.classed("zdg-dependency-handle-visible", false);
    if (!state.ctrlDown) return;
    if (!state.hoveredNodeEl) return;
    d3.select(state.hoveredNodeEl).classed(
      "zdg-dependency-handle-visible",
      true,
    );
  }

  nodes
    .on("mouseenter.dependencyEdit", function (e, d) {
      if (state.dragging) return;
      if (selectAndDragState?.isLassooing || selectAndDragState?.isDragging) {
        return;
      }
      state.hoveredNodeId = d.data.id;
      state.hoveredNodeEl = this;
      state.ctrlDown = !!e.ctrlKey;
      setEditModeClass(state.ctrlDown);
      updateNodeHandleVisibility();
    })
    .on("mouseleave.dependencyEdit", function (e) {
      if (state.dragging) return;
      // If we're moving within the same node group (e.g. toward the handle), don't clear hover.
      if (e.relatedTarget && this.contains(e.relatedTarget)) {
        return;
      }
      state.hoveredNodeId = null;
      state.hoveredNodeEl = null;
      updateNodeHandleVisibility();
    });

  // Keep node handle visible when hovering over the handle itself.
  nodeHandleCircle
    .on("mouseenter.dependencyEdit", function (e, d) {
      if (state.dragging) return;
      if (selectAndDragState?.isLassooing || selectAndDragState?.isDragging) {
        return;
      }
      state.hoveredNodeId = d.data.id;
      state.hoveredNodeEl = nodeIdToEl.get(d.data.id) || null;
      state.ctrlDown = !!e.ctrlKey;
      setEditModeClass(state.ctrlDown);
      updateNodeHandleVisibility();
    })
    .on("mouseleave.dependencyEdit", function (e, d) {
      if (state.dragging) return;
      const nodeEl = nodeIdToEl.get(d.data.id);
      if (e.relatedTarget && nodeEl && nodeEl.contains(e.relatedTarget)) {
        return;
      }
      state.hoveredNodeId = null;
      state.hoveredNodeEl = null;
      updateNodeHandleVisibility();
    });

  // --- Drag-to-create dependency (node outgoing handle) ---
  const createDrag = d3Drag()
    .filter(() => true) // allow ctrl-drag (d3 default filter blocks ctrlKey)
    .on("start", function (event, d) {
      if (!event.sourceEvent?.ctrlKey) return;
      if (selectAndDragState?.isLassooing || selectAndDragState?.isDragging) {
        return;
      }

      event.sourceEvent.stopPropagation?.();
      event.sourceEvent.preventDefault?.();

      state.dragging = true;
      state.dragSourceId = d.data.id;
      setEditModeClass(true);

      // Hide any non-dragging node handles during the drag.
      state.hoveredNodeId = null;
      state.hoveredNodeEl = null;
      nodes.classed("zdg-dependency-handle-visible", false);

      const startX = d.x;
      const startY = d.y;

      // Floating handle that follows the cursor during drag.
      nodeDragHandle = overlay
        .append("circle")
        .attr("class", "zdg-dependency-handle zdg-dependency-handle-dragging")
        .attr("r", handleRadius)
        .attr("cx", startX)
        .attr("cy", startY + rectHeight / 2 + handleOffset);

      dragline = underlay
        .append("path")
        .attr("class", "zdg-dependency-dragline")
        .attr("fill", "none")
        .attr("d", `M ${startX} ${startY} L ${startX} ${startY}`);
    })
    .on("drag", function (event, d) {
      if (!state.dragging || !state.dragSourceId) return;
      if (!event.sourceEvent?.ctrlKey) return;

      const { x, y } = getPointerSvgXY(event);
      nodeDragHandle?.attr("cx", x).attr("cy", y);

      const targetId = findNodeAtPoint(x, y, { excludeId: state.dragSourceId });
      setDropHover(targetId);

      // Draw preview from source boundary (not center), and to target boundary if hovering a node.
      let endX = x;
      let endY = y;
      if (targetId) {
        const t = nodeIdToDatum.get(targetId);
        if (t) {
          [endX, endY] = getNodeBoundaryIntersection({
            fromX: t.x,
            fromY: t.y,
            toX: d.x,
            toY: d.y,
          });
        }
      }

      const [startIx, startIy] = getNodeBoundaryIntersection({
        fromX: d.x,
        fromY: d.y,
        toX: endX,
        toY: endY,
      });

      dragline?.attr("d", `M ${startIx} ${startIy} L ${endX} ${endY}`);
    })
    .on("end", function (event, d) {
      if (!state.dragging) return;
      if (!event.sourceEvent?.ctrlKey) {
        state.dragging = false;
        state.dragSourceId = null;
        clearDragArtifacts();
        // Handles will re-appear on the next ctrl+hover.
        state.hoveredNodeId = null;
        state.hoveredNodeEl = null;
        nodes.classed("zdg-dependency-handle-visible", false);
        return;
      }

      const sourceId = state.dragSourceId;
      const targetId = state.dropTargetId;

      state.dragging = false;
      state.dragSourceId = null;

      if (!canAddEdge({ sourceId, targetId, data: graphData })) {
        clearDragArtifacts();
        nodes.classed("zdg-dependency-handle-visible", false);
        return;
      }

      const previous = cloneGraphData(graphData);
      const updated = cloneGraphData(graphData);
      const target = updated.find((n) => n.id === targetId);
      target.parentIds = uniq([...(target.parentIds || []), sourceId]);

      clearDragArtifacts();
      const layoutOverrides = snapshotLayoutOverrides();
      rerender(updated, layoutOverrides);
    });

  nodeHandleCircle.call(createDrag);

  // --- Edge hover hit paths ---
  // Create wide transparent hit paths for reliable hover. Enable only in edit mode via CSS.
  const lineNodes = lines.nodes();
  const linkData = lines.data();

  const edgesGroup = lines.node()?.parentNode
    ? d3.select(lines.node().parentNode)
    : svgSelection;

  const lineHits = edgesGroup
    .append("g")
    .attr("class", "zdg-line-hits")
    .selectAll("path")
    .data(linkData)
    .enter()
    .append("path")
    .attr("class", "zdg-line-hit")
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 12)
    .attr("d", (_, i) => lineNodes[i]?.getAttribute("d") || "");

  function hideEdgeHandle() {
    if (state.dragging) return;
    edgeHandle?.remove();
    edgeHandle = null;
    edgeDeleteButton?.remove();
    edgeDeleteButton = null;
    state.hoveredLink = null;
    clearDropHover();
  }

  function showEdgeDeleteButtonForLink(link, hitPathEl) {
    if (!hitPathEl?.getTotalLength || !hitPathEl?.getPointAtLength) return;
    if (state.dragging) return;

    // Midpoint of the hover hit path (matches the rendered edge curve).
    let p = null;
    try {
      const len = hitPathEl.getTotalLength();
      if (!Number.isFinite(len) || len <= 0) return;
      p = hitPathEl.getPointAtLength(len / 2);
    } catch {
      return;
    }
    if (!p) return;

    edgeDeleteButton?.remove();

    const g = overlay
      .append("g")
      .attr("class", "zdg-dependency-edge-delete")
      .attr("transform", `translate(${p.x}, ${p.y})`);

    g.append("title").text("Delete dependency");

    g.append("circle")
      .attr("class", "zdg-dependency-edge-delete-bg")
      .attr("r", 10);

    g.append("path")
      .attr("class", "zdg-dependency-edge-delete-x")
      // Simple X glyph (two strokes)
      .attr("d", "M -4 -4 L 4 4 M -4 4 L 4 -4");

    g.on("click.dependencyEdit", (event) => {
      event?.stopPropagation?.();
      event?.preventDefault?.();

      if (state.dragging) return;

      const sourceId = link?.source?.data?.id;
      const targetId = link?.target?.data?.id;
      if (!sourceId || !targetId) return;

      const updated = cloneGraphData(graphData);
      const target = updated.find((n) => n.id === targetId);
      if (!target) return;
      target.parentIds = removeFromArray(target.parentIds || [], sourceId);

      clearDragArtifacts();
      const layoutOverrides = snapshotLayoutOverrides();
      rerender(updated, layoutOverrides);
    });

    // Keep visible when moving from hit-path to delete button and back.
    g.on("mouseleave.dependencyEdit", (e) => {
      if (state.dragging) return;
      const rt = e?.relatedTarget;
      if (
        rt?.classList?.contains("zdg-line-hit") ||
        rt?.classList?.contains("zdg-dependency-edge-handle")
      ) {
        return;
      }
      hideEdgeHandle();
    });

    edgeDeleteButton = g;
  }

  function showEdgeHandleForLink(link) {
    const { source, target } = link;
    const [dx, dy] = getIntersection(
      source.x - target.x,
      source.y - target.y,
      target.x,
      target.y,
      (rectWidth + arrowSize / 3) / 2,
      (rectHeight + arrowSize / 3) / 2,
    );

    edgeHandle?.remove();
    edgeHandle = overlay
      .append("circle")
      .attr("class", "zdg-dependency-edge-handle")
      .attr("r", handleRadius)
      .attr("cx", dx)
      .attr("cy", dy);

    function ensureEdgePreview() {
      if (!edgePreviewLine) {
        edgePreviewLine = overlay
          .append("path")
          .attr("class", "zdg-dependency-edge-preview")
          .attr("fill", "none");
      }
      if (!edgePreviewArrow) {
        const arrow = d3.symbol().type(d3.symbolTriangle).size(arrowSize);
        edgePreviewArrow = overlay
          .append("path")
          .attr("class", "zdg-dependency-edge-preview-arrow")
          .attr("d", arrow);
      }
    }

    function updateEdgePreview({ endX, endY }) {
      ensureEdgePreview();
      const [startIx, startIy] = getNodeBoundaryIntersection({
        fromX: source.x,
        fromY: source.y,
        toX: endX,
        toY: endY,
      });
      edgePreviewLine.attr("d", `M ${startIx} ${startIy} L ${endX} ${endY}`);

      const rdx = source.x - endX;
      const rdy = source.y - endY;
      const angle = (Math.atan2(-rdy, -rdx) * 180) / Math.PI + 90;
      edgePreviewArrow.attr(
        "transform",
        `translate(${endX}, ${endY}) rotate(${angle})`,
      );
    }

    const moveDrag = d3Drag()
      .filter(() => true)
      .on("start", (event) => {
        if (!event.sourceEvent?.ctrlKey) return;
        event.sourceEvent.stopPropagation?.();
        event.sourceEvent.preventDefault?.();

        state.dragging = true;
        state.edgeHandleDragging = true;
        state.dragSourceId = source.data.id;
        state.dragOriginalLink = {
          sourceId: source.data.id,
          oldTargetId: target.data.id,
        };

        // Hide the current edge and delete button while the edge handle is being dragged.
        edgeDeleteButton?.remove();
        edgeDeleteButton = null;
        hideCurrentEdgeForLink(link);

        // Initialize preview at the existing edge endpoint.
        updateEdgePreview({ endX: dx, endY: dy });
      })
      .on("drag", (event) => {
        if (!state.dragging || !state.dragOriginalLink) return;
        if (!event.sourceEvent?.ctrlKey) return;

        const { x, y } = getPointerSvgXY(event);
        edgeHandle?.attr("cx", x).attr("cy", y);
        const targetId = findNodeAtPoint(x, y, {
          excludeId: state.dragOriginalLink.sourceId,
        });
        setDropHover(targetId);

        if (targetId) {
          const t = nodeIdToDatum.get(targetId);
          if (t) {
            const [ix, iy] = getIntersection(
              source.x - t.x,
              source.y - t.y,
              t.x,
              t.y,
              (rectWidth + arrowSize / 3) / 2,
              (rectHeight + arrowSize / 3) / 2,
            );
            updateEdgePreview({ endX: ix, endY: iy });
          } else {
            updateEdgePreview({ endX: x, endY: y });
          }
        } else {
          updateEdgePreview({ endX: x, endY: y });
        }
      })
      .on("end", (event) => {
        if (!state.dragging || !state.dragOriginalLink) return;

        const { sourceId, oldTargetId } = state.dragOriginalLink;
        const newTargetId = state.dropTargetId;

        state.dragging = false;
        state.edgeHandleDragging = false;
        state.dragSourceId = null;
        state.dragOriginalLink = null;

        // If no target found, or unchanged, just reset.
        if (!newTargetId || newTargetId === oldTargetId) {
          clearDragArtifacts();
          return;
        }

        // Validate new edge, but allow “moving” even if it duplicates existing? Prefer to block duplicates.
        if (!canAddEdge({ sourceId, targetId: newTargetId, data: graphData })) {
          clearDragArtifacts();
          return;
        }

        const previous = cloneGraphData(graphData);
        const updated = cloneGraphData(graphData);

        const oldTarget = updated.find((n) => n.id === oldTargetId);
        const newTarget = updated.find((n) => n.id === newTargetId);
        if (!oldTarget || !newTarget) {
          clearDragArtifacts();
          return;
        }

        oldTarget.parentIds = removeFromArray(
          oldTarget.parentIds || [],
          sourceId,
        );
        newTarget.parentIds = uniq([...(newTarget.parentIds || []), sourceId]);

        clearDragArtifacts();
        const layoutOverrides = snapshotLayoutOverrides();
        rerender(updated, layoutOverrides);
      });

    edgeHandle.call(moveDrag);
  }

  lineHits
    .on("mouseenter.dependencyEdit", function (e, link) {
      if (state.dragging) return;
      if (!e.ctrlKey) return;
      if (selectAndDragState?.isLassooing || selectAndDragState?.isDragging) {
        return;
      }
      state.ctrlDown = true;
      setEditModeClass(true);
      state.hoveredLink = link;
      showEdgeHandleForLink(link);
      showEdgeDeleteButtonForLink(link, this);
    })
    .on("mouseleave.dependencyEdit", function (e) {
      // If moving from the hit path to the edge handle (or arrow), keep it visible.
      if (
        e.relatedTarget?.classList?.contains("zdg-dependency-edge-handle") ||
        e.relatedTarget?.classList?.contains("zdg-arrow") ||
        e.relatedTarget?.closest?.(".zdg-dependency-edge-delete")
      ) {
        return;
      }
      hideEdgeHandle();
    });

  // --- Global Ctrl listeners (singleton) ---
  controller.onCtrlChange = (isDown) => {
    state.ctrlDown = !!isDown;
    setEditModeClass(state.ctrlDown);

    if (!state.ctrlDown) {
      updateNodeHandleVisibility();
      hideEdgeHandle();
      clearDropHover();
    } else {
      updateNodeHandleVisibility();
      // Edge handle is driven by hover; nothing to do here.
    }
  };

  if (!globalListenersInstalled) {
    globalListenersInstalled = true;

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Control") return;
      activeController?.onCtrlChange?.(true);
    });
    window.addEventListener("keyup", (e) => {
      if (e.key !== "Control") return;
      activeController?.onCtrlChange?.(false);
    });
    window.addEventListener("blur", () => {
      activeController?.onCtrlChange?.(false);
    });
  }

  return controller;
}
