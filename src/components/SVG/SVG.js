/**
 * External dependencies
 */
import { useEffect, useState, useRef } from "react";
import { Box, FormControl, Input, Text } from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import {
  generateGraph,
  removeNonEpicIssues,
  removeSelfContainedIssues,
  removePipelineIssues,
} from "../../d3";
import { getGraphData } from "../../data/graph-data";
import { isEmpty } from "../../utils/common";

export default function SVG({
  APIKey,
  appSettings,
  pipelineColors,
  additionalColors,
  pipelineHidden,
  coordinateOverrides,
  saveCoordinateOverrides,
  workspace,
  sprint,
  epic,
  setEpicIssue,
  setNonEpicIssues,
  setSelfContainedIssues,
  setHiddenIssues,
  currentGraphData,
  setCurrentGraphData,
}) {
  const ref = useRef();
  const [graphData, setGraphData] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(workspace) || isEmpty(epic)) {
      return;
    }

    setError(null);
    setLoading(true);

    const controller = new AbortController();
    const { signal } = controller;

    getGraphData(
      workspace,
      sprint,
      epic,
      "https://api.zenhub.com/public/graphql/",
      APIKey,
      signal,
      appSettings
    )
      .then(({ graphData, epicIssue }) => {
        if (!appSettings.showNonEpicIssues) {
          const nonEpicIssues = removeNonEpicIssues(graphData);
          setNonEpicIssues(nonEpicIssues);
        }

        if (!appSettings.showSelfContainedIssues) {
          const selfContainedIssues = removeSelfContainedIssues(graphData);
          setSelfContainedIssues(selfContainedIssues);
        }

        const hiddenIssues = [];
        Object.keys(pipelineHidden).forEach((pipelineName) => {
          hiddenIssues.push(...removePipelineIssues(graphData, pipelineName));
        });
        setHiddenIssues(hiddenIssues);

        setGraphData(graphData);
        setEpicIssue(epicIssue);
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setGraphData([]);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    workspace,
    epic,
    APIKey,
    setEpicIssue,
    appSettings,
    setNonEpicIssues,
    setSelfContainedIssues,
    setHiddenIssues,
    sprint,
    pipelineHidden,
  ]);

  useEffect(() => {
    try {
      generateGraph(
        graphData,
        ref.current,
        {
          pipelineColors,
          additionalColors,
          epic,
          coordinateOverrides,
          saveCoordinateOverrides,
          setCurrentGraphData,
        },
        appSettings
      );
    } catch (err) {
      console.log("generateGraph error", err);
      setError(err);
    }
  }, [
    graphData,
    appSettings,
    workspace,
    pipelineColors,
    additionalColors,
    coordinateOverrides,
    saveCoordinateOverrides,
    epic,
  ]);

  if (loading) {
    return <Text padding="20px">Loading...</Text>;
  }

  if (error) {
    return <Text padding="20px">{error.toString()}</Text>;
  }

  return (
    <Box h="calc(100vh - 80px)">
      <svg id="zdg-graph" style={{ width: "100%", height: "100%" }} ref={ref} />
    </Box>
  );
}
