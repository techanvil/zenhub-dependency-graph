export function getNodeColor(target, pipelineColors, colorMap) {
  return (
    pipelineColors[target.data.pipelineName] || colorMap.get(target.data.id)
  );
}

export function getArrowEndColor(source, target, pipelineColors, colorMap) {
  if (!source.data.isNonEpicIssue && target.data.isNonEpicIssue) {
    return "tomato";
  }

  return getNodeColor(target, pipelineColors, colorMap);
}

export function getIntersection(dx, dy, cx, cy, w, h) {
  if (Math.abs(dy / dx) < h / w) {
    // Hit vertical edge of box1
    return [cx + (dx > 0 ? w : -w), cy + (dy * w) / Math.abs(dx)];
  } else {
    // Hit horizontal edge of box1
    return [cx + (dx * h) / Math.abs(dy), cy + (dy > 0 ? h : -h)];
  }
}

export function toFixedDecimalPlaces(value, decimalPlaces) {
  return Number(
    Math.round(parseFloat(value + "e" + decimalPlaces)) + "e-" + decimalPlaces
  );
}

export function roundToGrid(nodeWidth, nodeHeight, x, y) {
  let newX = x - nodeWidth / 2;
  let newY = y - nodeHeight / 2;

  newX = Math.round(newX / nodeWidth) * nodeWidth + nodeWidth / 2;
  newY = Math.round(newY / nodeHeight) * nodeHeight + nodeHeight / 2;

  return [newX, newY];
}

function getRectHeight({ showIssueDetails, showIssueSprints }) {
  if (showIssueDetails) {
    return showIssueSprints ? 44 : 35;
  }

  return showIssueSprints ? 41 : 35;
}

export function getRectDimensions(appSettings) {
  return {
    rectWidth: 60,
    rectHeight: getRectHeight(appSettings),
  };
}

export function getCombinedSprints(sprints) {
  if (!sprints || sprints.length === 0) {
    return "";
  }

  // Assume each sprint name begins "Sprint".
  return (
    "Sprint " +
    sprints.map((sprint) => sprint.replace("Sprint ", "")).join(", ")
  );
}
