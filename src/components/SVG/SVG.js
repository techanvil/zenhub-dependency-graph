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

export default function SVG({ APIKey, workspace, epic, setEpicIssue }) {
  const ref = useRef();
  const [graphData, setGraphData] = useState();

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(workspace) || isEmpty(epic)) {
      return;
    }

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
    generateGraph(graphData, ref.current);
  }, [graphData]);

  return (
    <Box h="calc(100vh - 80px)">
      <svg style={{ width: "100%", height: "100%" }} ref={ref} />
    </Box>
  );
}
