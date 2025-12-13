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
    dragSourceId: null,
    dragOriginalLink: null, // { sourceId, oldTargetId }
    dropTargetId: null,
  };

  // --- Overlay for dragline + edge handle ---
  const overlay = svgSelection.append("g").attr("class", "zdg-edit-overlay");

  let dragline = null;
  let edgeHandle = null;

  function setEditModeClass(isOn) {
    svgSelection.classed("zdg-dependency-edit-mode", !!isOn);
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
    dragline?.remove();
    dragline = null;
    edgeHandle?.remove();
    edgeHandle = null;
    clearDropHover();
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

      const startX = d.x;
      const startY = d.y;

      dragline = overlay
        .append("path")
        .attr("class", "zdg-dependency-dragline")
        .attr("fill", "none")
        .attr("d", `M ${startX} ${startY} L ${startX} ${startY}`);
    })
    .on("drag", function (event, d) {
      if (!state.dragging || !state.dragSourceId) return;
      if (!event.sourceEvent?.ctrlKey) return;

      const { x, y } = getPointerSvgXY(event);
      dragline?.attr("d", `M ${d.x} ${d.y} L ${x} ${y}`);

      const targetId = findNodeAtPoint(x, y, { excludeId: state.dragSourceId });
      setDropHover(targetId);
    })
    .on("end", function (event, d) {
      if (!state.dragging) return;
      if (!event.sourceEvent?.ctrlKey) {
        state.dragging = false;
        state.dragSourceId = null;
        clearDragArtifacts();
        return;
      }

      const sourceId = state.dragSourceId;
      const targetId = state.dropTargetId;

      state.dragging = false;
      state.dragSourceId = null;

      if (!canAddEdge({ sourceId, targetId, data: graphData })) {
        clearDragArtifacts();
        return;
      }

      const updated = cloneGraphData(graphData);
      const target = updated.find((n) => n.id === targetId);
      target.parentIds = uniq([...(target.parentIds || []), sourceId]);

      clearDragArtifacts();
      rerender(updated);
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
    state.hoveredLink = null;
    clearDropHover();
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

    const moveDrag = d3Drag()
      .filter(() => true)
      .on("start", (event) => {
        if (!event.sourceEvent?.ctrlKey) return;
        event.sourceEvent.stopPropagation?.();
        event.sourceEvent.preventDefault?.();

        state.dragging = true;
        state.dragSourceId = source.data.id;
        state.dragOriginalLink = {
          sourceId: source.data.id,
          oldTargetId: target.data.id,
        };
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
      })
      .on("end", (event) => {
        if (!state.dragging || !state.dragOriginalLink) return;

        const { sourceId, oldTargetId } = state.dragOriginalLink;
        const newTargetId = state.dropTargetId;

        state.dragging = false;
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
        rerender(updated);
      });

    edgeHandle.call(moveDrag);
  }

  lineHits
    .on("mouseenter.dependencyEdit", function (e, link) {
      if (!e.ctrlKey) return;
      if (selectAndDragState?.isLassooing || selectAndDragState?.isDragging) {
        return;
      }
      state.ctrlDown = true;
      setEditModeClass(true);
      state.hoveredLink = link;
      showEdgeHandleForLink(link);
    })
    .on("mouseleave.dependencyEdit", function (e) {
      // If moving from the hit path to the edge handle (or arrow), keep it visible.
      if (
        e.relatedTarget?.classList?.contains("zdg-dependency-edge-handle") ||
        e.relatedTarget?.classList?.contains("zdg-arrow")
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
