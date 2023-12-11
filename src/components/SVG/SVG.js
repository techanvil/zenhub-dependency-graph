/**
 * External dependencies
 */
import { useEffect, useState, useRef } from "react";
import { Box, FormControl, Input, Text } from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import { generateGraph } from "../../utils/d3";
import { getGraphData } from "../../data/graph-data";
import { isEmpty } from "../../utils/common";

export default function SVG({
  APIKey,
  showAncestorDependencies,
  workspace,
  epic,
  setEpicIssue,
}) {
  const ref = useRef();
  const [graphData, setGraphData] = useState();
  const [error, setError] = useState();

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(workspace) || isEmpty(epic)) {
      return;
    }

    setError(null);

    const controller = new AbortController();
    const { signal } = controller;

    getGraphData(
      workspace,
      epic,
      "https://api.zenhub.com/public/graphql/",
      APIKey,
      signal
    )
      .then(({ graphData, epicIssue }) => {
        setGraphData(graphData);
        setEpicIssue(epicIssue);
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setGraphData([]);
      });

    return () => controller.abort();
  }, [workspace, epic, APIKey, setEpicIssue]);

  useEffect(() => {
    try {
      generateGraph(graphData, ref.current, { showAncestorDependencies });
    } catch (err) {
      console.log("generateGraph error", err);
      setError(err);
    }
  }, [graphData, showAncestorDependencies]);

  return (
    <Box h="calc(100vh - 80px)">
      {error ? (
        <Text>{error.toString()}</Text>
      ) : (
        <svg
          id="zdg-graph"
          style={{ width: "100%", height: "100%" }}
          ref={ref}
        />
      )}
    </Box>
  );
}
