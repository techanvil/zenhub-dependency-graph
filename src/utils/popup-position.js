/**
 * Calculates the optimal position for a popup given an anchor point in
 * screen coordinates (CSS pixels, suitable for `position: fixed`).
 */
export function calculatePopupPosition(
  anchorX,
  anchorY,
  { popupWidth = 0, popupHeight = 0, offset = 20 } = {},
) {
  let left = anchorX + offset;
  let top = anchorY - popupHeight / 2;

  // Adjust if popup would go off-screen horizontally
  if (left + popupWidth > window.innerWidth) {
    // Try positioning on the left side of the anchor
    const leftSidePosition = anchorX - popupWidth - offset;
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
