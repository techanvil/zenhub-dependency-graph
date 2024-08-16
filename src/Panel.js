import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { Box } from "@chakra-ui/react";
import { activePaneAtom, PANES } from "./store/atoms";
import { Legend } from "./components/Legend";

export default function Panel({ panel, ...sharedStateProps }) {
  const activePane = useAtomValue(activePaneAtom);

  // if (activePane === PANES.NONE) {
  //   return null;
  // }

  return (
    <Box p={activePane === PANES.NONE ? 0 : "1rem"}>
      {/* { activePane === PANES.SETTINGS && <Settings /> } */}
      {activePane === PANES.LEGEND && <Legend {...sharedStateProps} />}
      {panel && <ExternalPanel {...sharedStateProps} panel={panel} />}
    </Box>
  );
}

function ExternalPanel({ panel: { PanelComponent }, currentGraphData }) {
  const activePane = useAtomValue(activePaneAtom);

  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (activePane === PANES.EXTERNAL && !hasOpened) {
      setHasOpened(true);
    }
  }, [activePane, hasOpened]);

  console.log({
    activePane,
    hasOpened,
  });

  if (!hasOpened) {
    return null;
  }

  return (
    <Box display={activePane === PANES.EXTERNAL ? "block" : "none"}>
      <PanelComponent graphData={currentGraphData} />
    </Box>
  );
}
