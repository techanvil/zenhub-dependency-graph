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
  const [graphData, setGraphData] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [epic, setEpic] = useState(null);

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
    <Box>
      <FormControl>
        <Input
          placeholder="Workspace Name"
          onChange={(e) => setWorkspace(e.target.value)}
        />
      </FormControl>
      <FormControl>
        <Input
          placeholder="Epic Issue Number"
          onChange={(e) => setEpic(parseInt(e.target.value))}
        />
      </FormControl>
      <svg ref={ref} />
    </Box>
  );
}
