import * as d3 from "d3";

import { getCombinedSprints, getRectDimensions, getSprintsText } from "./utils";
import { pipelineAbbreviations } from "./constants";

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

function wrapLines(text, width, maxLines, truncate) {
  text.each(function () {
    let text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.1, // ems
      x = text.attr("x"),
      y = text.attr("y"),
      dy = 0, //parseFloat(text.attr("dy")),
      tspan = text
        .text(null)
        .append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", dy + "em"),
      lineCount = 1;

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        if (lineCount === maxLines) {
          truncate.call(tspan.node());
        } else {
          lineCount++;
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text
            .append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", ++lineNumber * lineHeight + dy + "em")
            .text(word);
        }
      }
    }
  });
}

export function renderDetailedIssues(nodes, appSettings) {
  const { showIssueEstimates, showIssueSprints } = appSettings;
  const { rectWidth, rectHeight } = getRectDimensions(appSettings);

  function truncate() {
    const self = d3.select(this);

    let textLength = self.node().getComputedTextLength(),
      text = self.text();

    while (textLength > rectWidth - 2 * padding && text.length > 0) {
      text = text.slice(0, -1);
      self.text(text + "\u2026");
      textLength = self.node().getComputedTextLength();
    }
  }

  // Add issue titles to nodes
  nodes
    .append("a")
    .attr("href", (d) => d.data.htmlUrl)
    .append("text")
    .text((d) => d.data.title)
    .attr("x", -rectWidth / 2 + padding)
    .attr("y", -rectHeight / 2 + 6)
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black")
    .call(wrapLines, rectWidth - padding * 2, 3, truncate);

  // Add assignees to nodes
  nodes
    // .append("a")
    // .attr("href", (d) => d.data.htmlUrl)
    .append("text")
    .text((d) => d.data.assignees.join(", "))
    .attr("x", -rectWidth / 2 + padding)
    // .attr("y", -rectHeight / 2 + 6)
    .attr("y", 5)
    .attr("font-family", "sans-serif")
    .attr("font-size", 4)
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black")
    .each(truncate);

  if (showIssueEstimates) {
    // Add estimate to nodes
    nodes
      .append("text")
      .text((d) => d.data.estimate)
      .attr("x", rectWidth / 2 - padding)
      .attr("y", 5)
      .attr("font-family", "sans-serif")
      .attr("font-size", 5)
      .attr("text-anchor", "end")
      .attr("alignment-baseline", "middle")
      .attr("fill", "black");
  }

  const issueNumberRowY = showIssueSprints ? 11 : rectHeight / 2 - 5;

  // Add issue number to nodes
  nodes
    .append("a")
    .attr("href", (d) => d.data.htmlUrl)
    .append("text")
    .text((d) => d.data.id)
    .attr("x", -rectWidth / 2 + padding)
    .attr("y", issueNumberRowY)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");

  // Add pipeline name to nodes
  nodes
    .append("text")
    .text((d) => getPipelineAbbreviation(d))
    .attr("x", rectWidth / 2 - padding)
    .attr("y", issueNumberRowY)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "end")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");

  // Add "External" text for non-epic issues to nodes
  nodes
    .filter((d) => d.data.isNonEpicIssue)
    .append("text")
    .text("External")
    .attr("y", issueNumberRowY)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");

  if (showIssueSprints) {
    // Add issue sprints to nodes
    nodes
      .append("a")
      .append("text")
      .text((d) => getCombinedSprints(d.data.sprints))
      .attr("x", -rectWidth / 2 + padding)
      .attr("y", rectHeight / 2 - 5)
      .attr("font-family", "sans-serif")
      .attr("font-size", 5)
      .attr("text-anchor", "start")
      .attr("alignment-baseline", "middle")
      .attr("fill", "black");
  }
}
