import { createClient, fetchExchange } from "urql";
import { authExchange } from "@urql/exchange-auth";
import { cacheExchange } from "@urql/exchange-graphcache";
import { makeDefaultStorage } from "@urql/exchange-graphcache/default-storage";
import { pipe, subscribe } from "wonka";

import { APIKeyAtom, store } from "../store/atoms";
import {
  GET_WORKSPACE_QUERY,
  GET_REPO_AND_PIPELINES_QUERY,
  GET_EPIC_LINKED_ISSUES_QUERY,
  GET_ISSUE_BY_NUMBER_QUERY,
  GET_ALL_EPICS,
  GET_ALL_ORGANIZATIONS,
  getAllEpicsQueryDocument,
} from "./queries";

if (!process.env.REACT_APP_ZENHUB_ENDPOINT_URL) {
  throw new Error("REACT_APP_ZENHUB_ENDPOINT_URL is required");
}

const storage = makeDefaultStorage({
  idbName: "graphcache-store", // Unique name for the database
  maxAge: 60 * 60 * 1000, // Data expiration (e.g., 1 hour in ms)
  sessionStorage: true, // Use sessionStorage instead of localStorage
});

const cache = cacheExchange({
  storage,
  resolvers: {
    // Define resolvers if needed for custom field resolution
  },
  updates: {
    // Update logic for mutations if needed
  },
});

export const client = createClient({
  url: process.env.REACT_APP_ZENHUB_ENDPOINT_URL,
  exchanges: [
    authExchange(async (utils) => {
      return {
        addAuthToOperation(operation) {
          const zenhubAPIKey = store.get(APIKeyAtom);

          if (!zenhubAPIKey) {
            console.warn("No Zenhub API key");
            return operation;
          }

          return utils.appendHeaders(operation, {
            Authorization: `Bearer ${zenhubAPIKey}`,
          });
        },
        didAuthError(error, operation) {
          console.log("didAuthError", { error, operation });

          return !!error;
        },
        async refreshAuth() {},
      };
    }),
    cache,
    fetchExchange,
  ],
  // exchanges: [cacheExchange, fetchExchange],
});

// function executeQuery<Q, V>(query: Q, variables: V) {
async function executeQuery(query, variables, signal) {
  // TODO: Refactor this to be a URQL exchange?
  return new Promise((resolve) => {
    const { unsubscribe } = pipe(
      client.query(query, variables),
      subscribe((result) => {
        console.info("executeQuery", result);
        resolve(result);
      }),
    );

    signal.addEventListener("abort", () => {
      unsubscribe();
    });
  });
}

function getNonEpicIssues(issues, relationshipProperty) {
  return issues.map((issue) =>
    issue[relationshipProperty].nodes.filter(
      (relatedIssue) =>
        !issues.some((issue) => issue.number === relatedIssue.number),
    ),
  );
}

async function getAllIssues(gqlQuery, issues, variables, appSettings) {
  const { workspaceId, repositoryGhId } = variables;

  const nonEpicBlockingIssues = getNonEpicIssues(issues, "blockingIssues");

  const nonEpicIssues = [
    ...nonEpicBlockingIssues,
    ...(appSettings.showNonEpicBlockedIssues
      ? getNonEpicIssues(issues, "blockedIssues")
      : []),
  ].flatMap((a) => a);

  const dedupedNonEpicIssues = Object.values(
    nonEpicIssues.reduce((issueMap, issue) => {
      issueMap[issue.number] = issue;
      return issueMap;
    }, {}),
  );

  if (dedupedNonEpicIssues.length === 0) {
    return issues;
  }

  // FIXME: Find a way to avoid making a query per single issue!
  const nonEpicIssuesFull = await Promise.all(
    dedupedNonEpicIssues.map(async (issue) => {
      const { issueByInfo } = await gqlQuery(
        GET_ISSUE_BY_NUMBER_QUERY,
        "GetIssueByNumber",
        {
          workspaceId,
          repositoryGhId,
          issueNumber: issue.number,
        },
      );
      return { ...issueByInfo, isNonEpicIssue: true };
    }),
  );

  const allIssues = [...issues, ...nonEpicIssuesFull];

  return getAllIssues(gqlQuery, allIssues, variables, appSettings);
}

async function getLinkedIssues(
  gqlQuery,
  { workspaceId, repositoryId, repositoryGhId, epicIssueNumber, pipelineIds },
  appSettings,
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
    },
  );

  return getAllIssues(
    gqlQuery,
    linkedIssues.nodes,
    {
      workspaceId,
      repositoryGhId,
    },
    appSettings,
  );
}

export async function getAllOrganizations(endpointUrl, zenhubApiKey, signal) {
  const gqlQuery = createGqlQuery(endpointUrl, zenhubApiKey, signal);

  const {
    viewer: {
      zenhubOrganizations: { nodes: organizations },
    },
  } = await gqlQuery(GET_ALL_ORGANIZATIONS, "GetAllOrganizations", {});

  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    workspaces: organization.workspaces.nodes.map(({ id, name }) => ({
      id,
      name,
    })),
  }));
}

export async function getWorkspaces(
  workspaceName,
  endpointUrl,
  zenhubApiKey,
  signal,
) {
  const gqlQuery = createGqlQuery(endpointUrl, zenhubApiKey, signal);

  const {
    viewer: {
      searchWorkspaces: { nodes: workspaces },
    },
  } = await gqlQuery(GET_WORKSPACE_QUERY, "GetWorkSpace", {
    workspaceName,
  });

  return workspaces.map(
    ({
      id,
      name,
      zenhubOrganization: { name: zenhubOrganizationName },
      sprints,
      activeSprint,
    }) => ({
      id,
      name,
      zenhubOrganizationName,
      sprints: sprints.nodes,
      activeSprint,
    }),
  );
}

/*
export async function getAllEpics(
  workspaceId,
  endpointUrl,
  zenhubApiKey,
  signal,
) {
  const gqlQuery = createGqlQuery(endpointUrl, zenhubApiKey, signal);

  const {
    workspace: {
      epics: { nodes: epics },
    },
  } = await gqlQuery(GET_ALL_EPICS, "GetAllEpics", {
    workspaceId,
  });

  return epics.map((epic) => epic.issue);
}
*/

export async function getAllEpics(workspaceId, signal) {
  // const result = await client.query(getAllEpicsQueryDocument, {
  //   workspaceId,
  // });

  const result = await executeQuery(
    getAllEpicsQueryDocument,
    { workspaceId },
    signal,
  );

  if (!result.data?.workspace?.epics?.nodes) {
    console.warn("No epics", { result });
    return [];
  }

  const {
    workspace: {
      epics: { nodes: epics },
    },
  } = result.data;

  return epics.map((epic) => epic.issue);
}

export async function getGraphData(
  workspaceName,
  sprintName,
  epicIssueNumber,
  endpointUrl,
  zenhubApiKey,
  signal,
  appSettings,
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

  const linkedIssues = await getLinkedIssues(
    gqlQuery,
    {
      workspaceId,
      repositoryId,
      repositoryGhId,
      epicIssueNumber,
      pipelineIds: pipelines.map((pipeline) => pipeline.id),
    },
    appSettings,
  );

  const d3GraphData = linkedIssues.map(
    ({
      number: id,
      title,
      htmlUrl,
      state,
      isNonEpicIssue,
      assignees: { nodes: assignees },
      blockingIssues,
      pipelineIssue: {
        pipeline: { name: pipelineName },
      },
      estimate,
      sprints,
    }) => ({
      id: `${id}`,
      title,
      htmlUrl,
      isNonEpicIssue,
      assignees: assignees.map(({ login }) => login),
      parentIds: blockingIssues.nodes.map(({ number }) => `${number}`),
      pipelineName: state === "CLOSED" ? "Closed" : pipelineName,
      estimate: estimate?.value,
      sprints: sprints.nodes.map(({ name }) => name),
      isChosenSprint: sprints.nodes.some(({ name }) => name === sprintName),
    }),
  );

  /*
  const { issueByInfo: epicIssue } = await gqlQuery(
    GET_ISSUE_BY_NUMBER_QUERY,
    "GetIssueByNumber",
    {
      workspaceId,
      repositoryGhId,
      issueNumber: epicIssueNumber,
    }
  );
  */

  console.log("workspace", workspaceId);
  console.log("repository", repositoryId, repositoryGhId);
  console.log("pipelines", pipelines);
  console.log("linkedIssues", linkedIssues);
  console.log("d3GraphData", d3GraphData);

  window.zdgDebugInfo = {
    ...(window.zdgDebugInfo || {}),
    workspaceId,
    repositoryId,
    repositoryGhId,
    pipelines,
    linkedIssues,
    d3GraphData,
  };

  return {
    graphData: d3GraphData,
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

    // const res = await fetch(endpointUrl, options);
    // return (await res.json()).data;
    const res = await cachedFetch(endpointUrl, options);
    return res.data;
  };
}

// Cache responses for 1 hour.
const cachedFetch = async (url, options) => {
  // Generate a unique key for the request
  const cacheKey = `cachedFetch:${url}:${JSON.stringify(options)}`;

  // Check if the cached response is still valid
  const cachedResponse = sessionStorage.getItem(cacheKey);
  if (cachedResponse) {
    const { data, expiry } = JSON.parse(cachedResponse);

    // Check if the response has not expired
    if (expiry > Date.now()) {
      return data;
    }

    // If the response has expired, remove it from the cache
    sessionStorage.removeItem(cacheKey);
  }

  // Fetch the data
  const response = await fetch(url, options);

  // Check if the request was successful
  if (response.ok) {
    // Parse the response body
    const data = await response.json();

    // Calculate the expiry time (e.g., 1 hour from the current time)
    const expiry = Date.now() + 3600000;

    // Cache the response with the expiry time in session storage
    const cachedData = JSON.stringify({ data, expiry });
    sessionStorage.setItem(cacheKey, cachedData);

    // Return the data
    return data;
  }

  // If the request was not successful, throw an error
  throw new Error(`Request failed with status ${response.status}`);
};
