export const GET_WORKSPACE_QUERY = gql`
  query GetWorkSpace($workspaceName: String!) {
    viewer {
      searchWorkspaces(query: $workspaceName) {
        nodes {
          id
        }
      }
    }
  }
`;

export const GET_REPO_AND_PIPELINES_QUERY = gql`
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
`;

export const GET_EPIC_LINKED_ISSUES_QUERY = gql`
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
        number
        title
        htmlUrl
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
      }
    }
  }
`;

export const GET_ISSUE_BY_NUMBER_QUERY = gql`
  query GetIssueByNumber(
    $workspaceId: ID!
    $repositoryGhId: Int!
    $issueNumber: Int!
  ) {
    issueByInfo(issueNumber: $issueNumber, repositoryGhId: $repositoryGhId) {
      number
      title
      htmlUrl
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
    }
  }
`;

// For the sake of syntax highlighting:
function gql(strings) {
  return strings[0];
}
