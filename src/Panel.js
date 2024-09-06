import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { Box } from "@chakra-ui/react";
import { activePaneAtom, currentGraphDataAtom, PANES } from "./store/atoms";
import { Legend } from "./components/Legend";

export default function Panel({ panel, ...sharedStateProps }) {
  const activePane = useAtomValue(activePaneAtom);

  // if (activePane === PANES.NONE) {
  //   return null;
  // }

  return (
    <Box
      className="panel-scroll-wrapper"
      maxH="var(--main-height)"
      overflow="scroll"
      display={activePane === PANES.NONE ? "none" : "block"}
    >
      <Box p="1rem">
        {/* { activePane === PANES.SETTINGS && <Settings /> } */}
        {activePane === PANES.LEGEND && <Legend {...sharedStateProps} />}
        {panel && <ExternalPanel panel={panel} />}
      </Box>
    </Box>
  );
}

function ExternalPanel({ panel: { PanelComponent } }) {
  const currentGraphData = useAtomValue(currentGraphDataAtom);
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
