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
