import { convertSvgToDocumentCoordinates } from "../d3/coordinate-utils";

/**
 * Calculates the optimal position for a popup given SVG coordinates
 */
export function calculatePopupPosition(
  x,
  y,
  {
    svgElement = document.querySelector("#zdg-graph"),
    panZoomInstance = null,
    dagWidth = 0,
    dagHeight = 0,
    popupWidth = 400,
    popupHeight = 300,
    offset = 20,
  } = {},
) {
  let left, top;

  // Convert SVG coordinates to document coordinates if we have the necessary parameters
  if (panZoomInstance && dagWidth && dagHeight && svgElement) {
    const documentCoords = convertSvgToDocumentCoordinates(
      x,
      y,
      panZoomInstance,
      dagWidth,
      dagHeight,
    );
    left = documentCoords.x + offset;
    top = documentCoords.y;
  } else if (svgElement) {
    // Fallback: calculate position relative to SVG element's document position
    const rect = svgElement.getBoundingClientRect();
    left = rect.left + x + offset;
    top = rect.top + y;
  } else {
    // Last resort: use the coordinates as-is
    left = x + offset;
    top = y;
  }

  // Adjust if popup would go off-screen
  if (left + popupWidth > window.innerWidth) {
    left = left - popupWidth - offset * 2; // Move to left side of node
  }
  if (top < 0) {
    top = 10;
  }
  if (top + popupHeight > window.innerHeight) {
    top = window.innerHeight - popupHeight - 10;
  }

  return { x: left, y: top };
}
