/**
 * External dependencies
 */
import { useEffect, useState, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Box, Text } from "@chakra-ui/react";

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
  additionalColorsAtom,
  APIKeyAtom,
  appSettingsAtom,
  coordinateOverridesAtom,
  baselineGraphDataAtom,
  currentGraphDataAtom,
  epicAtom,
  graphRenderNonceAtom,
  hiddenIssuesAtom,
  nonEpicIssuesAtom,
  pipelineColorsAtom,
  pipelineHiddenAtom,
  selfContainedIssuesAtom,
  sprintAtom,
  store,
  workspaceAtom,
} from "../../store/atoms";
import IssuePreviewPopup from "../IssuePreviewPopup/IssuePreviewPopup";

export default function SVG() {
  const ref = useRef();
  const [graphData, setGraphData] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);

  function cloneGraphData(data) {
    if (!Array.isArray(data)) return data;
    return data.map((n) => ({
      ...n,
      parentIds: n.parentIds ? [...n.parentIds] : [],
    }));
  }

  const setNonEpicIssues = useSetAtom(nonEpicIssuesAtom);
  const setSelfContainedIssues = useSetAtom(selfContainedIssuesAtom);
  const setHiddenIssues = useSetAtom(hiddenIssuesAtom);
  const setCurrentGraphData = useSetAtom(currentGraphDataAtom);
  const setBaselineGraphData = useSetAtom(baselineGraphDataAtom);

  const APIKey = useAtomValue(APIKeyAtom);
  const appSettings = useAtomValue(appSettingsAtom);
  const workspace = useAtomValue(workspaceAtom);
  const epic = useAtomValue(epicAtom);
  const sprint = useAtomValue(sprintAtom);
  const pipelineColors = useAtomValue(pipelineColorsAtom);
  const additionalColors = useAtomValue(additionalColorsAtom);
  const pipelineHidden = useAtomValue(pipelineHiddenAtom);
  const [coordinateOverrides, saveCoordinateOverrides] = useAtom(
    coordinateOverridesAtom,
  );
  const graphRenderNonce = useAtomValue(graphRenderNonceAtom);

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(workspace) || isEmpty(epic)) {
      return;
    }

    setError(null);
    setLoading(true);
    // Reset baseline while loading a new graph so pending changes don't leak between epics/workspaces.
    setBaselineGraphData(undefined);

    const controller = new AbortController();
    const { signal } = controller;

    getGraphData(workspace, sprint, epic, appSettings, signal)
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

        const loaded = cloneGraphData(graphData);
        setGraphData(loaded);
        setBaselineGraphData(cloneGraphData(loaded));
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setGraphData([]);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort("getGraphData");
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
      // Use the latest in-memory graph when forcing a redraw (e.g. after applying pending ops).
      const latestGraphData = store.get(currentGraphDataAtom) || graphData;
      generateGraph(
        latestGraphData,
        ref.current,
        {
          pipelineColors,
          additionalColors,
          epic,
          coordinateOverrides,
          saveCoordinateOverrides,
          setCurrentGraphData,
        },
        appSettings,
      );
    } catch (err) {
      console.log("generateGraph error", err);
      setError(err);
    }
  }, [
    graphData,
    graphRenderNonce,
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
    <Box h="var(--main-height)" position="relative">
      <svg id="zdg-graph" style={{ width: "100%", height: "100%" }} ref={ref} />
      <IssuePreviewPopup />
    </Box>
  );
}
