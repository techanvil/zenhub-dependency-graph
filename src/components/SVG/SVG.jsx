/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Box, Text } from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import {
  removeNonEpicIssues,
  removeSelfContainedIssues,
  removePipelineIssues,
  removeAncestorDependencies,
} from "../../d3";
import { getGraphData } from "../../data/graph-data";
import { isEmpty } from "../../utils/common";
import GraphCanvas from "../GraphCanvas/GraphCanvas";
import {
  additionalColorsAtom,
  APIKeyAtom,
  appSettingsAtom,
  coordinateOverridesAtom,
  currentGraphDataAtom,
  epicAtom,
  hiddenIssuesAtom,
  nonEpicIssuesAtom,
  pipelineColorsAtom,
  pipelineHiddenAtom,
  selfContainedIssuesAtom,
  sprintAtom,
  workspaceAtom,
} from "../../store/atoms";
import IssuePreviewPopup from "../IssuePreviewPopup/IssuePreviewPopup";

export default function SVG() {
  const [graphData, setGraphData] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);

  const setNonEpicIssues = useSetAtom(nonEpicIssuesAtom);
  const setSelfContainedIssues = useSetAtom(selfContainedIssuesAtom);
  const setHiddenIssues = useSetAtom(hiddenIssuesAtom);
  const setCurrentGraphData = useSetAtom(currentGraphDataAtom);

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

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(workspace) || isEmpty(epic)) {
      return;
    }

    setError(null);
    setLoading(true);

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

        // Match the previous SVG/D3 behavior.
        if (!appSettings.showAncestorDependencies) {
          removeAncestorDependencies(graphData);
        }

        setGraphData(graphData);
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

  if (loading) {
    return <Text padding="20px">⏳ Loading...</Text>;
  }

  if (error) {
    return <Text padding="20px">❌ {error.toString()}</Text>;
  }

  return (
    <Box h="var(--main-height)" position="relative" bg="white">
      {graphData ? (
        <GraphCanvas
          graphData={graphData}
          appSettings={appSettings}
          pipelineColors={pipelineColors}
          additionalColors={additionalColors}
          coordinateOverrides={coordinateOverrides}
          saveCoordinateOverrides={saveCoordinateOverrides}
          setCurrentGraphData={setCurrentGraphData}
        />
      ) : null}
      <IssuePreviewPopup />
    </Box>
  );
}
