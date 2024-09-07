/**
 * External dependencies
 */
import { useEffect, useState, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
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
import {
  APIKeyAtom,
  appSettingsAtom,
  currentGraphDataAtom,
  hiddenIssuesAtom,
  nonEpicIssuesAtom,
  selfContainedIssuesAtom,
} from "../../store/atoms";

export default function SVG({
  pipelineColors,
  additionalColors,
  pipelineHidden,
  coordinateOverrides,
  saveCoordinateOverrides,
  workspace,
  sprint,
  epic,
}) {
  const ref = useRef();
  const [graphData, setGraphData] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);

  const setNonEpicIssues = useSetAtom(nonEpicIssuesAtom);
  const setSelfContainedIssues = useSetAtom(selfContainedIssuesAtom);
  const setHiddenIssues = useSetAtom(hiddenIssuesAtom);
  const setCurrentGraphData = useSetAtom(currentGraphDataAtom);

  const APIKey = useAtomValue(APIKeyAtom);
  const appSettings = useAtomValue(appSettingsAtom);

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
      .then(({ graphData }) => {
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
    appSettings,
    setNonEpicIssues,
    setSelfContainedIssues,
    setHiddenIssues,
    sprint,
    pipelineHidden,
  ]);

  useEffect(() => {
    if (loading || error || !graphData || !ref.current) {
      return;
    }

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
    setCurrentGraphData,
    loading,
    error,
  ]);

  if (loading) {
    return <Text padding="20px">⏳ Loading...</Text>;
  }

  if (error) {
    return <Text padding="20px">❌ {error.toString()}</Text>;
  }

  return (
    <Box h="var(--main-height)">
      <svg id="zdg-graph" style={{ width: "100%", height: "100%" }} ref={ref} />
    </Box>
  );
}
