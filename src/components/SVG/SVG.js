/**
 * External dependencies
 */
import { useEffect, useState, useRef } from "react";
import { Box, FormControl, Input } from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import { generateGraph } from "../../utils/d3";
import { getGraphData } from "../../data/graph-data";
import { isEmpty } from "../../utils/common";
import { useLocalStorage } from "../../hooks/useLocalStorage";

export default function SVG() {
  const [APIKey] = useLocalStorage("zenhubAPIKey");
  const [workspace] = useLocalStorage("zenhubWorkspace");
  const [epic] = useLocalStorage("zenhubEpicIssueNumber");

  const ref = useRef();

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(workspace) || isEmpty(epic)) {
      return;
    }

    async function renderGraph() {
      const graphData = await getGraphData(
        workspace,
        epic,
        "https://api.zenhub.com/public/graphql/",
        APIKey
      );

      generateGraph(graphData, ref.current);
    }

    renderGraph();
  }, [workspace, epic, APIKey]);

  return (
    <Box h="calc(100vh - 80px)">
      <svg style={{ width: "100%", height: "100%" }} ref={ref} />
    </Box>
  );
}
