import { simpleIssueDimensions, pipelineAbbreviations } from "./constants.js";

const { rectWidth, rectHeight } = simpleIssueDimensions;

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

export function renderSimpleIssues(nodes, { showIssueEstimates }) {
  // Add issue number to nodes
  nodes
    .append("a")
    .attr("href", (d) => d.data.htmlUrl)
    .append("text")
    .text((d) => d.data.id)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 20)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");

  // TODO: GH issue on hover?

  if (showIssueEstimates) {
    // Add estimate to nodes
    nodes
      .append("text")
      .text((d) => d.data.estimate)
      .attr("x", -rectWidth / 2 + padding)
      .attr("y", rectHeight / 2 - 5)
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
    .attr("y", rectHeight / 2 - 5)
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
    .attr("y", rectHeight / 2 - 5)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");
}
