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
    popupWidth = 800, // TODO: Create constants for the popup width and height.
    popupHeight = 600,
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

  // Adjust if popup would go off-screen horizontally
  if (left + popupWidth > window.innerWidth) {
    // Try positioning on the left side of the node (subtract offset to get node position, then subtract popup width)
    const nodePosition = left - offset;
    const leftSidePosition = nodePosition - popupWidth - offset;
    if (leftSidePosition >= 10) {
      const newLeft = leftSidePosition;
      left = newLeft;
    } else {
      // If left side doesn't work either, clamp to screen bounds
      left = window.innerWidth - popupWidth - 10;
    }
  }

  // Final safety check to ensure popup stays within screen bounds
  if (left < 10) {
    left = 10;
  }
  if (left + popupWidth > window.innerWidth - 10) {
    left = window.innerWidth - popupWidth - 10;
  }
  if (left < 0) {
    left = 0;
  }

  if (top < 10) {
    top = 10;
  }
  if (top + popupHeight > window.innerHeight) {
    top = window.innerHeight - popupHeight - 10;
  }
  if (top < 0) {
    top = 0;
  }

  return { x: left, y: top };
}
