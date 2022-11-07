import { getGraphData } from "./data/graph-data.js";
import { renderGraph } from "./visualisation.js";

const { workspaceName, epicIssueNumber, endpointUrl, zenhubApiKey } =
  await fetch("./config.json").then((res) => res.json());

const graphData = await getGraphData(
  workspaceName,
  epicIssueNumber,
  endpointUrl,
  zenhubApiKey
);

renderGraph(graphData);

// const data = [
//   {
//     id: "5890",
//     title: "Implement new design for User Input questions",
//     parentIds: ["5888"],
//     pipelineName: "Execution Backlog",
//   },
//   {
//     id: "5898",
//     title: "Store User Input answers in Site Database",
//     parentIds: ["5888"],
//     pipelineName: "Execution Backlog",
//   },
//   {
//     id: "5888",
//     title: "Update questions and related copies of User Input Screens ",
//     parentIds: [],
//     pipelineName: "Execution",
//   },
// ];

// renderGraph(data);

const downloadButton = document.getElementById("download-svg");
downloadButton.addEventListener("click", async () => {
  const svgEl = document.querySelector("svg");
  svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svgData = svgEl.outerHTML;
  const preface = '<?xml version="1.0" standalone="no"?>\r\n';
  const svgBlob = new Blob([preface, svgData], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = "graph";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
});
