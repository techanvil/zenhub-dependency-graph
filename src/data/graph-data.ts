import {
  createClient,
  fetchExchange,
  OperationContext,
  OperationResult,
  OperationResultSource,
  DocumentInput,
} from "urql";
import { TypedDocumentNode } from "@urql/core";
import { AnyVariables } from "@urql/core";
import { authExchange } from "@urql/exchange-auth";
import { cacheExchange } from "@urql/exchange-graphcache";
import { makeDefaultStorage } from "@urql/exchange-graphcache/default-storage";
import { pipe, subscribe } from "wonka";

import { APIKeyAtom, store } from "../store/atoms";
import {
  getWorkspaceQueryDocument,
  getRepoAndPipelinesQueryDocument,
  getEpicLinkedIssuesQueryDocument,
  getIssueByNumberQueryDocument,
  getAllEpicsQueryDocument,
  getAllOrganizationsQueryDocument,
} from "./queries";
import { GetEpicLinkedIssuesQuery } from "../gql/graphql";

interface AppSettings {
  showNonEpicBlockedIssues: boolean;
}

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

function executeQuery<Data, Variables extends AnyVariables>(
  query: DocumentInput<Data, Variables>,
  variables: Variables,
  signal: AbortSignal,
): Promise<OperationResult<Data, Variables>> {
  // TODO: Rewrite this to be a URQL exchange?
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

type Issue = NonNullable<GetEpicLinkedIssuesQuery["linkedIssues"]>["nodes"][0];
type ExtendedIssue = Issue & { isNonEpicIssue?: boolean };

function getNonEpicIssues(
  issues: ExtendedIssue[],
  relationshipProperty: "blockingIssues" | "blockedIssues",
) {
  return issues.map((issue) =>
    issue[relationshipProperty].nodes.filter(
      (relatedIssue) =>
        !issues.some((issue) => issue.number === relatedIssue.number),
    ),
  );
}

async function getAllIssues(
  issues: ExtendedIssue[],
  variables: { workspaceId: string; repositoryGhId: number },
  appSettings: AppSettings,
  signal: AbortSignal,
) {
  const { workspaceId, repositoryGhId } = variables;

  const nonEpicBlockingIssues = getNonEpicIssues(issues, "blockingIssues");

  const nonEpicIssues = [
    ...nonEpicBlockingIssues,
    ...(appSettings.showNonEpicBlockedIssues
      ? getNonEpicIssues(issues, "blockedIssues")
      : []),
  ].flatMap((a) => a);

  const dedupedNonEpicIssues = Object.values(
    nonEpicIssues.reduce(
      (
        issueMap: {
          [key: string]: ReturnType<typeof getNonEpicIssues>[0][0];
          // NonNullable<GetEpicLinkedIssuesQuery["linkedIssues"]>["nodes"][0]["blockingIssues"]["nodes"][0]
        },
        issue,
      ) => {
        issueMap[issue.number] = issue;
        return issueMap;
      },
      {},
    ),
  );

  if (dedupedNonEpicIssues.length === 0) {
    return issues;
  }

  // FIXME: Find a way to avoid making a query per single issue!
  const nonEpicIssuesFull = await Promise.all(
    dedupedNonEpicIssues.map(async (issue) => {
      const result = await executeQuery(
        getIssueByNumberQueryDocument,
        {
          workspaceId,
          repositoryGhId,
          issueNumber: issue.number,
        },
        signal,
      );
      // const result = await client.query(getIssueByNumberQueryDocument, {
      //   workspaceId,
      //   repositoryGhId,
      //   issueNumber: issue.number,
      // });

      if (!result.data?.issueByInfo) {
        console.warn("No issueByInfo", { issue });
        return null;
      }

      const { issueByInfo } = result.data;

      return { ...issueByInfo, isNonEpicIssue: true };
    }),
  );

  const allIssues = [...issues, ...nonEpicIssuesFull].filter(
    (issue) => !!issue,
  );

  return getAllIssues(allIssues, variables, appSettings, signal);
}

async function getLinkedIssues(
  {
    workspaceId,
    repositoryId,
    repositoryGhId,
    epicIssueNumber,
    pipelineIds,
  }: {
    workspaceId: string;
    repositoryId: string;
    repositoryGhId: number;
    epicIssueNumber: number;
    pipelineIds: string[];
  },
  appSettings: AppSettings,
  signal: AbortSignal,
) {
  const result = await executeQuery(
    getEpicLinkedIssuesQueryDocument,
    {
      workspaceId,
      repositoryId,
      repositoryGhId,
      epicIssueNumber,
      pipelineIds,
    },
    signal,
  );

  if (!result.data?.linkedIssues) {
    console.warn("No linkedIssues", { result });
    return [];
  }

  const { linkedIssues } = result.data;

  return getAllIssues(
    linkedIssues.nodes,
    {
      workspaceId,
      repositoryGhId,
    },
    appSettings,
    signal,
  );
}

export async function getAllOrganizations(signal: AbortSignal) {
  const result = await executeQuery(
    getAllOrganizationsQueryDocument,
    {},
    signal,
  );

  if (!result.data?.viewer?.zenhubOrganizations?.nodes) {
    console.warn("No organizations", { result });
    return [];
  }

  const {
    viewer: {
      zenhubOrganizations: { nodes: organizations },
    },
  } = result.data;

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
  workspaceName: string,
  signal: AbortSignal,
) {
  const result = await executeQuery(
    getWorkspaceQueryDocument,
    { workspaceName },
    signal,
  );

  if (!result.data?.viewer?.searchWorkspaces?.nodes) {
    console.warn("No workspaces", { result });
    return [];
  }

  const {
    viewer: {
      searchWorkspaces: { nodes: workspaces },
    },
  } = result.data;

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

export async function getAllEpics(workspaceId: string, signal: AbortSignal) {
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
  workspaceName: string,
  sprintName: string,
  epicIssueNumber: number,
  appSettings: { showNonEpicBlockedIssues: boolean },
  signal: AbortSignal,
) {
  console.log("getGraphData", workspaceName, epicIssueNumber);

  const workspaceResult = await executeQuery(
    getWorkspaceQueryDocument,
    {
      workspaceName,
    },
    signal,
  );

  if (!workspaceResult.data?.viewer?.searchWorkspaces?.nodes) {
    console.warn("No workspaces", { workspaceResult });
    return null;
  }

  const {
    viewer: {
      searchWorkspaces: {
        nodes: [{ id: workspaceId }],
      },
    },
  } = workspaceResult.data;

  const repoAndPipelinesResult = await executeQuery(
    getRepoAndPipelinesQueryDocument,
    {
      workspaceId,
    },
    signal,
  );

  if (!repoAndPipelinesResult.data?.workspace?.defaultRepository) {
    console.warn("No workspace", { repoAndPipelinesResult });
    return null;
  }

  const {
    workspace: {
      defaultRepository: { id: repositoryId, ghId: repositoryGhId },
      pipelinesConnection: { nodes: pipelines },
    },
  } = repoAndPipelinesResult.data;

  /*
  const repoAndPipelinesResult = await executeQuery(
    getRepoAndPipelinesQueryDocument,
    {
      workspaceId,
    },
    signal,
  );

  if (!repoAndPipelinesResult.data?.workspace?.defaultRepository) {
    console.warn("No defaultRepository", { repoAndPipelinesResult });
    return null;
  }

  const {
    workspace: {
      defaultRepository: { id: repositoryId, ghId: repositoryGhId },
      pipelinesConnection: { nodes: pipelines },
    },
  } = repoAndPipelinesResult.data;
  */

  const linkedIssues = await getLinkedIssues(
    {
      workspaceId,
      repositoryId,
      repositoryGhId,
      epicIssueNumber,
      pipelineIds: pipelines.map((pipeline) => pipeline.id),
    },
    appSettings,
    signal,
  );

  const epicGraphData = linkedIssues
    .map((issue) => {
      if (!issue.pipelineIssue?.pipeline) {
        console.warn("No pipeline", { issue });
        return null;
      }

      const {
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
      } = issue;
      return {
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
      };
    })
    .filter((issue) => !!issue);

  const issueByNumberResult = await client.query(
    getIssueByNumberQueryDocument,
    {
      workspaceId,
      repositoryGhId,
      issueNumber: epicIssueNumber,
    },
  );

  if (!issueByNumberResult.data?.issueByInfo) {
    console.warn("No issueByInfo", { issueByNumberResult });
    return null;
  }

  const { issueByInfo: epicIssue } = issueByNumberResult.data;

  // console.log("epicIssue", epicIssue);
  // console.log("workspace", workspaceId);
  // console.log("repository", repositoryId, repositoryGhId);
  // console.log("pipelines", pipelines);
  // console.log("linkedIssues", linkedIssues);
  // console.log("d3GraphData", d3GraphData);

  // window.zdgDebugInfo = {
  //   ...(window.zdgDebugInfo || {}),
  //   epicIssue,
  //   workspaceId,
  //   repositoryId,
  //   repositoryGhId,
  //   pipelines,
  //   linkedIssues,
  //   d3GraphData,
  // };

  return {
    graphData: epicGraphData,
    epicIssue,
  };
}

/*
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
*/
