/**
 * Shared coordinate transformation utilities for D3 graph operations
 */

/**
 * Gets the SVG ratio used for coordinate transformations
 */
export function getSvgRatio(
  containerRect: DOMRect,
  panZoomViewportRect: DOMRect,
  dagWidth: number,
  dagHeight: number,
): number {
  if (panZoomViewportRect.width === containerRect.width) {
    return containerRect.width / dagWidth;
  }

  if (panZoomViewportRect.height === containerRect.height) {
    return containerRect.height / dagHeight;
  }

  return containerRect.width / dagWidth;
}

/**
 * Gets the container and viewport rectangles needed for coordinate transformations
 */
export function getContainerAndViewportRects(): {
  containerRect: DOMRect | null;
  panZoomViewportRect: DOMRect | null;
} {
  const containerRect =
    document.getElementById("graph-container")?.getBoundingClientRect() || null;
  const panZoomViewport = document.querySelector(".svg-pan-zoom_viewport");
  const panZoomViewportRect = panZoomViewport?.getBoundingClientRect() || null;

  return {
    containerRect,
    panZoomViewportRect,
  };
}

/**
 * Converts SVG coordinates to document coordinates, accounting for pan/zoom transformations
 */
export function convertSvgToDocumentCoordinates(
  svgX: number,
  svgY: number,
  panZoomInstance: any,
  dagWidth: number,
  dagHeight: number,
): { x: number; y: number } {
  if (!panZoomInstance) {
    // Fallback: return original coordinates
    return { x: svgX, y: svgY };
  }

  const pan = panZoomInstance.getPan();
  const zoom = panZoomInstance.getZoom();

  const { containerRect, panZoomViewportRect } = getContainerAndViewportRects();

  if (!containerRect || !panZoomViewportRect) {
    // Fallback: return original coordinates
    return { x: svgX, y: svgY };
  }

  const svgRatio = getSvgRatio(
    containerRect,
    panZoomViewportRect,
    dagWidth,
    dagHeight,
  );

  // Convert from SVG coordinates to document coordinates
  const documentX = containerRect.left + (svgX * svgRatio * zoom + pan.x);
  const documentY = containerRect.top + (svgY * svgRatio * zoom + pan.y);

  return {
    x: documentX,
    y: documentY,
  };
}
