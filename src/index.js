import { getGraphData } from "./data/graph-data.js";
import { renderGraph, removeGraph } from "./visualisation.js";

const { endpointUrl } = await fetch("./config.json").then((res) => res.json());

const form  = document.getElementById('data-inputs');
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  removeGraph();

  const { zenhubApiKey, workspaceName, epicIssueNumber } = form.elements;

  const graphData = await getGraphData(
    workspaceName.value,
    parseInt( epicIssueNumber.value ),
    endpointUrl,
    zenhubApiKey.value
  );

  renderGraph(graphData);
});
