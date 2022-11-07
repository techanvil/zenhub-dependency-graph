// Initially cribbed from the Codepen linked on https://github.com/erikbrinkman/d3-dag
// Added some arrows sourced from https://observablehq.com/@tomvalsler/d3-dag-sugiyama-with-arrows

const pipelineColors = {
  Triage: "#de425b",
  Stalled: "#ea6158",
  Backlog: "#f27e59",
  "Acceptance Criteria": "#f79960",
  "Acceptance Criteria Review": "#fbb46c",
  "Implementation Brief": "#fdce7f",
  "Implementation Brief Review": "#ffe796",
  "Execution Backlog": "#e3d881",
  Execution: "#c7c96d",
  "Code Review": "#a9ba5b",
  "Merge Review": "#8bac4b",
  QA: "#6b9e3d",
  Approval: "#488f31",
};

const pipelineAbbreviations = {
  Triage: "T",
  Stalled: "S",
  Backlog: "B",
  "Acceptance Criteria": "AC",
  "Acceptance Criteria Review": "ACR",
  "Implementation Brief": "IB",
  "Implementation Brief Review": "IBR",
  "Execution Backlog": "EB",
  Execution: "E",
  "Code Review": "CR",
  "Merge Review": "MR",
  QA: "QA",
  Approval: "A",
};

function getIntersection(dx, dy, cx, cy, w, h) {
  if (Math.abs(dy / dx) < h / w) {
    // Hit vertical edge of box1
    return [cx + (dx > 0 ? w : -w), cy + (dy * w) / Math.abs(dx)];
  } else {
    // Hit horizontal edge of box1
    return [cx + (dx * h) / Math.abs(dy), cy + (dy > 0 ? h : -h)];
  }
}

export function renderGraph(d3GraphData) {
  // const data = [
  //   {
  //     id: "0",
  //     parentIds: [],
  //   },
  //   {
  //     id: "1",
  //     parentIds: ["0"],
  //   },
  //   {
  //     id: "2",
  //     parentIds: [],
  //   },
  //   {
  //     id: "3",
  //     parentIds: ["2"],
  //   },
  //   {
  //     id: "4",
  //     parentIds: ["3", "5"],
  //   },
  //   {
  //     id: "5",
  //     parentIds: [],
  //   },
  //   {
  //     id: "6",
  //     parentIds: ["4"],
  //   },
  // ];

  const dag = d3.dagStratify()(d3GraphData);
  // const nodeRadius = 20;
  const rectWidth = 60;
  const rectHeight = 30;
  const nodeWidth = rectWidth * 1.5;
  const nodeHeight = rectHeight * 2;
  const arrowSize = nodeHeight / 2.0;
  const layout = d3
    .sugiyama() // base layout
    .decross(d3.decrossOpt()) // minimize number of crossings
    .nodeSize((node) =>
      node === undefined ? [0, 0] : [nodeWidth, nodeHeight]
    ); // set node size instead of constraining to fit
  // .nodeSize((node) => [(node ? 3.6 : 0.25) * nodeRadius, 3 * nodeRadius]); // set node size instead of constraining to fit
  const { width, height } = layout(dag);

  // --------------------------------
  // This code only handles rendering
  // --------------------------------
  const svgSelection = d3.select("svg");
  svgSelection.attr("viewBox", [0, 0, width, height].join(" "));
  const defs = svgSelection.append("defs"); // For gradients

  // const steps = dag.size();
  // const interp = d3.interpolateRainbow;
  // const colorMap = new Map();
  // for (const [i, node] of dag.idescendants().entries()) {
  //   colorMap.set(node.data.id, interp(i / steps));
  // }

  // How to draw edges
  const line = d3
    .line()
    .curve(d3.curveCatmullRom)
    .x((d) => d.x)
    .y((d) => d.y);

  // Plot edges
  svgSelection
    .append("g")
    .selectAll("path")
    .data(dag.links())
    .enter()
    .append("path")
    .attr("d", ({ points }) => {
      console.log({ points });
      const [source, target] = points;
      const [dx, dy] = getIntersection(
        source.x - target.x,
        source.y - target.y,
        target.x,
        target.y,
        (rectWidth + arrowSize / 3) / 2,
        (rectHeight + arrowSize / 3) / 2
      );
      return line([source, { x: dx, y: dy }]);
    })
    .attr("fill", "none")
    .attr("stroke-width", 3)
    .attr("stroke", ({ source, target }) => {
      const [dx, dy] = getIntersection(
        source.x - target.x,
        source.y - target.y,
        target.x,
        target.y,
        (rectWidth + arrowSize / 3) / 2,
        (rectHeight + arrowSize / 3) / 2
      );

      // encodeURIComponents for spaces, hope id doesn't have a `--` in it
      const gradId = encodeURIComponent(`${source.data.id}--${target.data.id}`);
      const grad = defs
        .append("linearGradient")
        .attr("id", gradId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", source.x)
        .attr("x2", dx)
        .attr("y1", source.y)
        .attr("y2", dy);
      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", pipelineColors[source.data.pipelineName]);
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", pipelineColors[target.data.pipelineName]);
      return `url(#${gradId})`;
    });

  // Select nodes
  const nodes = svgSelection
    .append("g")
    .selectAll("g")
    .data(dag.descendants())
    .enter()
    .append("g")
    .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);

  // Plot node outlines
  // nodes
  //   .append("rect")
  //   .attr("width", nodeWidth)
  //   .attr("height", nodeHeight)
  //   .attr("fill", "rgba(0,0,0,0)")
  //   .attr("x", -nodeWidth / 2)
  //   .attr("y", -nodeHeight / 2)
  //   .attr("stroke", "#2378ae")
  //   .attr("stroke-dasharray", "10,5")
  //   .attr("stroke-linecap", "butt")
  //   .attr("stroke-width", 1);

  // Plot node rects
  nodes
    .append("rect")
    .attr("width", rectWidth)
    .attr("height", rectHeight)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("x", -rectWidth / 2)
    .attr("y", -rectHeight / 2)
    .attr("fill", (n) => pipelineColors[n.data.pipelineName]);
  // .attr("fill", "rgba(0,0,0,0)")
  // .attr("stroke", "#4378ae")
  // .attr("stroke-dasharray", "10,5")
  // .attr("stroke-linecap", "butt")
  // .attr("stroke-width", 1);

  // Draw arrows
  const arrow = d3.symbol().type(d3.symbolTriangle).size(arrowSize);
  svgSelection
    .append("g")
    .selectAll("path")
    .data(dag.links())
    .enter()
    .append("path")
    .attr("d", arrow)
    // .attr("transform", ({ source, target, data }) => {
    .attr("transform", ({ source, target, points }) => {
      const [end, start] = points.reverse();
      // This sets the arrows the node radius (20) + a little bit (3) away from the node center, on the last line segment of the edge. This means that edges that only span ine level will work perfectly, but if the edge bends, this will be a little off.
      const rdx = start.x - end.x;
      const rdy = start.y - end.y;
      const [dx, dy] = getIntersection(
        start.x - end.x,
        start.y - end.y,
        end.x,
        end.y,
        (rectWidth + arrowSize / 3) / 2,
        (rectHeight + arrowSize / 3) / 2
      );
      // console.log({ target, start, end, dx, dy });
      const scale = ((nodeHeight / 3) * 1.15) / Math.sqrt(dx * dx + dy * dy);
      // This is the angle of the last line segment
      const angle = (Math.atan2(-rdy, -rdx) * 180) / Math.PI + 90;
      // return `translate(${end.x + dx * scale}, ${
      //   end.y + dy * scale
      // }) rotate(${angle})`;
      return `translate(${dx}, ${dy}) rotate(${angle})`;
    })
    .attr("fill", ({ target }) => pipelineColors[target.data.pipelineName]);
  // .attr("stroke", "white")
  // .attr("stroke-width", 1.5);

  const padding = 3;

  // Add issue number to nodes
  nodes
    .append("a")
    .attr("xlink:href", (d) => d.data.htmlUrl)
    .append("text")
    .text((d) => d.data.id)
    .attr("x", -rectWidth / 2 + padding)
    .attr("y", rectHeight / 2 - 5)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");

  function wrapLines(text, width, maxLines) {
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

  function truncate() {
    // const padding = 3;
    // const padding = 0;

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
    .attr("xlink:href", (d) => d.data.htmlUrl)
    .append("text")
    .text((d) => d.data.title)
    .attr("x", -rectWidth / 2 + padding)
    .attr("y", -rectHeight / 2 + 6)
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black")
    .call(wrapLines, rectWidth - padding * 2, 3);

  nodes
    .append("text")
    .text((d) => pipelineAbbreviations[d.data.pipelineName])
    // .text((d) => d.data.pipelineName)
    .attr("x", rectWidth / 2 - padding)
    .attr("y", rectHeight / 2 - 5)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("font-size", 5)
    .attr("text-anchor", "end")
    .attr("alignment-baseline", "middle")
    .attr("fill", "black");
  // .call(wrapLines, rectWidth - padding * 2, 3);
}
