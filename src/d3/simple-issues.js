import { getCombinedSprints, getRectDimensions } from "./utils.js";
import { pipelineAbbreviations } from "./constants.js";

function getPipelineAbbreviation(node) {
  return (
    pipelineAbbreviations[node.data.pipelineName] ||
    node.data.pipelineName
      .match(/\b([A-Za-z0-9])/g)
      .join("")
      .toUpperCase()
  );
}

const padding = 3;

export function renderSimpleIssues(nodes, appSettings) {
  const { showIssueEstimates, showIssueSprints } = appSettings;
  const { rectWidth, rectHeight } = getRectDimensions(appSettings);

  if (showIssueSprints) {
    // Add issue sprints to nodes
    nodes
      .append("text")
      .text((d) => getCombinedSprints(d.data.sprints))
      .attr("x", -rectWidth / 2 + padding)
      // .attr("y", rectHeight / 2 - 5)
      .attr("y", -rectHeight / 2 + 6)
      .attr("font-family", "sans-serif")
      .attr("font-size", 6)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
      .attr("fill", "black");
  }

  // Add issue number to nodes
  nodes
    .append("a")
    .attr("href", (d) => d.data.htmlUrl)
    .append("text")
    .text((d) => d.data.id)
    .attr("y", showIssueSprints ? 2 : 0)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 20)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");

  // TODO: GH issue on hover?

  // const pipelineNameRowY = showIssueSprints ? 12 : rectHeight / 2 - 5;
  const pipelineNameRowY = rectHeight / 2 - 5;

  if (showIssueEstimates) {
    // Add estimate to nodes
    nodes
      .append("text")
      .text((d) => d.data.estimate)
      .attr("x", -rectWidth / 2 + padding)
      .attr("y", pipelineNameRowY)
      .attr("font-family", "sans-serif")
      .attr("font-size", 8)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
      .attr("fill", "black");
  }

  // Add pipeline name to nodes
  nodes
    .append("text")
    .text((d) => getPipelineAbbreviation(d))
    .attr("x", rectWidth / 2 - padding)
    .attr("y", pipelineNameRowY)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 8)
    .attr("text-anchor", "end")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");

  // Add "External" text for non-epic issues to nodes
  nodes
    .filter((d) => d.data.isNonEpicIssue)
    .append("text")
    .text("External")
    .attr("y", pipelineNameRowY)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");
}
