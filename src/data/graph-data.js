import {
  GET_WORKSPACE_QUERY,
  GET_REPO_AND_PIPELINES_QUERY,
  GET_EPIC_LINKED_ISSUES_QUERY,
  GET_ISSUE_BY_NUMBER_QUERY,
} from "./queries.js";

async function getAllIssues(gqlQuery, issues, { workspaceId, repositoryGhId }) {
  const nonEpicBlockingIssues = issues.map(({ blockingIssues }) =>
    blockingIssues.nodes.filter(
      (blockingIssue) =>
        !issues.some((issue) => issue.number === blockingIssue.number)
    )
  );

  const nonEpicBlockedIssues = issues.map(({ blockedIssues }) =>
    blockedIssues.nodes.filter(
      (blockedIssue) =>
        !issues.some((issue) => issue.number === blockedIssue.number)
    )
  );

  const nonEpicIssues = [
    ...nonEpicBlockedIssues,
    ...nonEpicBlockingIssues,
  ].flatMap((a) => a);

  if (nonEpicIssues.length === 0) {
    return issues;
  }

  // FIXME: Find a way to avoid making a query per single issue!
  const nonEpicIssuesFull = await Promise.all(
    nonEpicIssues.map(async (issue) => {
      const { issueByInfo } = await gqlQuery(
        GET_ISSUE_BY_NUMBER_QUERY,
        "GetIssueByNumber",
        {
          workspaceId,
          repositoryGhId,
          issueNumber: issue.number,
        }
      );
      return { ...issueByInfo, isNonEpicIssue: true };
    })
  );

  const allIssues = [...issues, ...nonEpicIssuesFull];

  return getAllIssues(gqlQuery, allIssues, { workspaceId, repositoryGhId });
}

async function getLinkedIssues(
  gqlQuery,
  { workspaceId, repositoryId, repositoryGhId, epicIssueNumber, pipelineIds }
) {
  const { linkedIssues } = await gqlQuery(
    GET_EPIC_LINKED_ISSUES_QUERY,
    "GetEpicLinkedIssues",
    {
      workspaceId,
      repositoryId,
      repositoryGhId,
      epicIssueNumber,
      pipelineIds,
    }
  );

  return getAllIssues(gqlQuery, linkedIssues.nodes, {
    workspaceId,
    repositoryGhId,
  });
}

export async function getGraphData(
  workspaceName,
  epicIssueNumber,
  endpointUrl,
  zenhubApiKey,
  signal
) {
  const gqlQuery = createGqlQuery(endpointUrl, zenhubApiKey, signal);

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
  } = await gqlQuery(GET_REPO_AND_PIPELINES_QUERY, "GetRepoAndPipelines", {
    workspaceId,
  });

  const linkedIssues = await getLinkedIssues(gqlQuery, {
    workspaceId,
    repositoryId,
    repositoryGhId,
    epicIssueNumber,
    pipelineIds: pipelines.map((pipeline) => pipeline.id),
  });

  const d3GraphData = linkedIssues.map(
    ({
      number: id,
      title,
      htmlUrl,
      isNonEpicIssue,
      assignees: { nodes: assignees },
      blockingIssues,
      pipelineIssue: {
        pipeline: { name: pipelineName },
      },
    }) => ({
      id: `${id}`,
      title,
      htmlUrl,
      isNonEpicIssue,
      assignees: assignees.map(({ login }) => login),
      parentIds: blockingIssues.nodes.map(({ number }) => `${number}`),
      pipelineName,
    })
  );

  const { issueByInfo: epicIssue } = await gqlQuery(
    GET_ISSUE_BY_NUMBER_QUERY,
    "GetIssueByNumber",
    {
      workspaceId,
      repositoryGhId,
      issueNumber: epicIssueNumber,
    }
  );

  console.log("epicIssue", epicIssue);
  console.log("workspace", workspaceId);
  console.log("repository", repositoryId, repositoryGhId);
  console.log("pipelines", pipelines);
  console.log("linkedIssues", linkedIssues);
  console.log("d3GraphData", d3GraphData);

  return {
    graphData: d3GraphData,
    epicIssue,
  };
}

function createGqlQuery(endpointUrl, zenhubApiKey, signal) {
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
      signal,
    };

    const res = await fetch(endpointUrl, options);
    return (await res.json()).data;
  };
}
