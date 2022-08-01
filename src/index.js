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
