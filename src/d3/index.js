function isAncestorOfNode(nodeId, ancestorId, graphData) {
  const node = graphData.find(({ id }) => id === nodeId);

  if (!node) {
    return false;
  }

  const { parentIds } = node;

  return !!parentIds?.some((parentId) => {
    if (parentId === ancestorId) {
      return true;
    }

    return isAncestorOfNode(parentId, ancestorId, graphData);
  });
}

function removeAncestors(graphData) {
  graphData?.forEach((node) => {
    const { parentIds } = node;

    if (!(parentIds && parentIds.length > 1)) {
      return;
    }

    const ancestorParentIds = [];

    parentIds.forEach((parentId) => {
      parentIds.forEach((otherParentId) => {
        if (isAncestorOfNode(parentId, otherParentId, graphData)) {
          ancestorParentIds.push(otherParentId);
        }
      });
    });

    node.parentIds = node.parentIds.filter(
      (parentId) => !ancestorParentIds.includes(parentId),
    );
  });
}

// Public wrapper used by the Three.js renderer to match the legacy SVG behavior.
export function removeAncestorDependencies(graphData) {
  removeAncestors(graphData);
}

export function removeNonEpicIssues(graphData) {
  const nonEpicIssues = graphData?.filter((node) => node.isNonEpicIssue);

  graphData?.forEach((node) => {
    const { parentIds } = node;

    if (!parentIds?.length) {
      return;
    }

    node.parentIds = node.parentIds.filter(
      (parentId) =>
        !nonEpicIssues.some((nonEpicIssue) => nonEpicIssue.id === parentId),
    );
  });

  // remove nonEpicIssues from graphData, mutating it:
  nonEpicIssues?.forEach((nonEpicIssue) => {
    const index = graphData.findIndex((node) => node.id === nonEpicIssue.id);

    if (index > -1) {
      graphData.splice(index, 1);
    }
  });

  return nonEpicIssues;
}

// Remove issues which have no parents and aren't the parent for any issues.
export function removeSelfContainedIssues(graphData) {
  const selfContainedIssues = graphData?.filter((node) => {
    if (node.parentIds?.length) {
      return false;
    }

    return !graphData?.some((otherNode) =>
      otherNode.parentIds?.includes(node.id),
    );
  });

  // remove selfContainedIssues from graphData, mutating it:
  selfContainedIssues?.forEach((selfContainedIssue) => {
    const index = graphData.findIndex(
      (node) => node.id === selfContainedIssue.id,
    );

    if (index > -1) {
      graphData.splice(index, 1);
    }
  });

  return selfContainedIssues;
}

function findNonPipelineParents(node, graphData, pipelineName) {
  const nonPipelineParents = [];

  node.parentIds?.forEach((parentId) => {
    const parent = graphData.find((node) => node.id === parentId);

    if (!parent) {
      return;
    }

    if (parent.pipelineName === pipelineName) {
      nonPipelineParents.push(
        ...findNonPipelineParents(parent, graphData, pipelineName),
      );
    } else {
      nonPipelineParents.push(parent);
    }
  });

  return nonPipelineParents;
}

export function removePipelineIssues(graphData, pipelineName) {
  const pipelineIssues = graphData?.filter(
    (node) => node.pipelineName === pipelineName,
  );

  const fullGraphData = [...graphData];

  // remove pipelineIssues from graphData, mutating it:
  pipelineIssues?.forEach((pipelineIssue) => {
    const index = graphData.findIndex((node) => node.id === pipelineIssue.id);

    if (index > -1) {
      graphData.splice(index, 1);
    }
  });

  pipelineIssues?.forEach((pipelineIssue) => {
    graphData?.forEach((node) => {
      if (node.parentIds?.includes(pipelineIssue.id)) {
        node.parentIds = node.parentIds.filter(
          (parentId) => parentId !== pipelineIssue.id,
        );

        const nonPipelineParents = findNonPipelineParents(
          pipelineIssue,
          fullGraphData,
          pipelineName,
        );

        nonPipelineParents.forEach((openParent) => {
          if (!node.parentIds.includes(openParent.id)) {
            node.parentIds.push(openParent.id);
          }
        });
      }
    });
  });

  return pipelineIssues;
}
