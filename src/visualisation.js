// Initially cribbed from the Codepen linked on https://github.com/erikbrinkman/d3-dag
// Added some arrows sourced from https://observablehq.com/@tomvalsler/d3-dag-sugiyama-with-arrows

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
  const nodeRadius = 20;
  const layout = d3
    .sugiyama() // base layout
    .decross(d3.decrossOpt()) // minimize number of crossings
    .nodeSize((node) => [(node ? 3.6 : 0.25) * nodeRadius, 3 * nodeRadius]); // set node size instead of constraining to fit
  const { width, height } = layout(dag);

  // --------------------------------
  // This code only handles rendering
  // --------------------------------
  const svgSelection = d3.select("svg");
  svgSelection.attr("viewBox", [0, 0, width, height].join(" "));
  const defs = svgSelection.append("defs"); // For gradients

  const steps = dag.size();
  const interp = d3.interpolateRainbow;
  const colorMap = new Map();
  for (const [i, node] of dag.idescendants().entries()) {
    colorMap.set(node.data.id, interp(i / steps));
  }

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
    .attr("d", ({ points }) => line(points))
    .attr("fill", "none")
    .attr("stroke-width", 3)
    .attr("stroke", ({ source, target }) => {
      // encodeURIComponents for spaces, hope id doesn't have a `--` in it
      const gradId = encodeURIComponent(`${source.data.id}--${target.data.id}`);
      const grad = defs
        .append("linearGradient")
        .attr("id", gradId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", source.x)
        .attr("x2", target.x)
        .attr("y1", source.y)
        .attr("y2", target.y);
      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorMap.get(source.data.id));
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorMap.get(target.data.id));
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

  // Plot node circles
  nodes
    .append("circle")
    .attr("r", nodeRadius)
    .attr("fill", (n) => colorMap.get(n.data.id));

  // Draw arrows
  const arrow = d3
    .symbol()
    .type(d3.symbolTriangle)
    .size((nodeRadius * nodeRadius) / 5.0);
  svgSelection
    .append("g")
    .selectAll("path")
    .data(dag.links())
    .enter()
    .append("path")
    .attr("d", arrow)
    // .attr("transform", ({ source, target, data }) => {
    .attr("transform", (...args) => {
      const { source, target, points } = args[0];
      const [end, start] = points.reverse();
      // This sets the arrows the node radius (20) + a little bit (3) away from the node center, on the last line segment of the edge. This means that edges that only span ine level will work perfectly, but if the edge bends, this will be a little off.
      const dx = start.x - end.x;
      const dy = start.y - end.y;
      const scale = (nodeRadius * 1.15) / Math.sqrt(dx * dx + dy * dy);
      // This is the angle of the last line segment
      const angle = (Math.atan2(-dy, -dx) * 180) / Math.PI + 90;
      console.log(angle, dx, dy);
      return `translate(${end.x + dx * scale}, ${
        end.y + dy * scale
      }) rotate(${angle})`;
    })
    .attr("fill", ({ target }) => colorMap.get(target.data.id))
    .attr("stroke", "white")
    .attr("stroke-width", 1.5);

  // Add text to nodes
  nodes
    .append("text")
    .text((d) => d.data.id)
    .attr("font-weight", "bold")
    .attr("font-family", "sans-serif")
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("fill", "white");
}

export function removeGraph() {
  const svg = d3.select("svg");
  svg.selectAll("*").remove();
}
