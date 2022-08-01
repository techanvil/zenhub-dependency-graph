import {
  GET_WORKSPACE_QUERY,
  GET_REPO_AND_PIPELINES,
  GET_LINKED_ISSUES,
} from "./queries.js";

export async function getGraphData(
  workspaceName,
  epicIssueNumber,
  endpointUrl,
  zenhubApiKey
) {
  const gqlQuery = createGqlQuery(endpointUrl, zenhubApiKey);

  const {
    viewer: {
      searchWorkspaces: {
        nodes: [{ id: workspaceId }],
      },
    },
  } = await gqlQuery(GET_WORKSPACE_QUERY, "GetWorkSpace", {
    workspaceName,
  });

  const {
    workspace: {
      defaultRepository: { id: repositoryId, ghId: repositoryGhId },
      pipelinesConnection: { nodes: pipelines },
    },
  } = await gqlQuery(GET_REPO_AND_PIPELINES, "GetRepoAndPipelines", {
    workspaceId,
  });

  const { linkedIssues } = await gqlQuery(
    GET_LINKED_ISSUES,
    "GetLinkedIssues",
    {
      workspaceId,
      repositoryId,
      repositoryGhId,
      epicIssueNumber,
      pipelineIds: pipelines.map((pipeline) => pipeline.id),
    }
  );

  const d3GraphData = linkedIssues.nodes.map(
    ({ number: id, blockingIssues }) => ({
      id: `${id}`,
      parentIds: blockingIssues.nodes.map(({ number }) => `${number}`),
    })
  );

  console.log("workspace", workspaceId);
  console.log("repository", repositoryId, repositoryGhId);
  console.log("pipelines", pipelines);
  console.log("linkedIssues", linkedIssues);
  console.log("d3GraphData", d3GraphData);

  return d3GraphData;
}

function createGqlQuery(endpointUrl, zenhubApiKey) {
  return async function gqlQuery(query, operationName, variables) {
    const options = {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenhubApiKey}`,
      },
      body: JSON.stringify({
        operationName,
        query,
        variables,
      }),
    };

    const res = await fetch(endpointUrl, options);
    return (await res.json()).data;
  };
}
