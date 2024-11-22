import { graphql } from "../gql";

export const getWorkspaceQueryDocument = graphql(`
  query GetWorkSpace($workspaceName: String!) {
    viewer {
      searchWorkspaces(query: $workspaceName) {
        nodes {
          id
          name
          zenhubOrganization {
            name
          }
          activeSprint {
            # id
            name
          }
          sprints(filters: { state: { eq: OPEN } }) {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  }
`);

export const getRepoAndPipelinesQueryDocument = graphql(`
  query GetRepoAndPipelines($workspaceId: ID!) {
    workspace(id: $workspaceId) {
      defaultRepository {
        id
        ghId
      }
      pipelinesConnection {
        nodes {
          id
        }
      }
    }
  }
`);

/*
export const EpicIssue_IssueFragment = graphql(`
  fragment EpicIssue_IssueFragment on Issue {
    number
    title
    htmlUrl
    state
    assignees {
      nodes {
        login
        # name
      }
    }
    blockingIssues {
      nodes {
        number
      }
    }
    blockedIssues {
      nodes {
        number
      }
    }
    pipelineIssue(workspaceId: $workspaceId) {
      pipeline {
        name
      }
    }
    estimate {
      value
    }
    sprints {
      nodes {
        # id
        name
      }
    }
  }
`);
*/

export const getEpicLinkedIssuesQueryDocument = graphql(`
  query GetEpicLinkedIssues(
    $workspaceId: ID!
    $repositoryId: ID!
    $repositoryGhId: Int!
    $epicIssueNumber: Int!
    $pipelineIds: [ID!]!
  ) {
    linkedIssues: searchIssues(
      workspaceId: $workspaceId
      epicIssueByInfo: {
        repositoryGhId: $repositoryGhId
        issueNumber: $epicIssueNumber
      }
      includeClosed: true
      filters: { repositoryIds: [$repositoryId], pipelineIds: $pipelineIds }
    ) {
      nodes {
        # ...EpicIssue_IssueFragment
        number
        title
        htmlUrl
        state
        assignees {
          nodes {
            login
            # name
          }
        }
        blockingIssues {
          nodes {
            number
          }
        }
        blockedIssues {
          nodes {
            number
          }
        }
        pipelineIssue(workspaceId: $workspaceId) {
          pipeline {
            name
          }
        }
        estimate {
          value
        }
        sprints {
          nodes {
            # id
            name
          }
        }
      }
    }
  }
`);

export const getIssueByNumberQueryDocument = graphql(`
  query GetIssueByNumber(
    $workspaceId: ID!
    $repositoryGhId: Int!
    $issueNumber: Int!
  ) {
    issueByInfo(issueNumber: $issueNumber, repositoryGhId: $repositoryGhId) {
      number
      title
      htmlUrl
      state
      assignees {
        nodes {
          login
          # name
        }
      }
      pipelineIssue(workspaceId: $workspaceId) {
        pipeline {
          name
        }
      }
      blockingIssues {
        nodes {
          number
        }
      }
      blockedIssues {
        nodes {
          number
        }
      }
      sprints {
        nodes {
          # id
          name
        }
      }
      estimate {
        value
      }
    }
  }
`);

export const getAllOrganizationsQueryDocument = graphql(`
  query GetAllOrganizations {
    viewer {
      zenhubOrganizations {
        nodes {
          id
          name
          workspaces {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  }
`);

export const getAllEpicsQueryDocument = graphql(`
  query GetAllEpics($workspaceId: ID!) {
    workspace(id: $workspaceId) {
      epics {
        nodes {
          issue {
            number
            title
            closedAt
          }
        }
      }
    }
  }
`);
