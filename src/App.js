/**
 * External dependencies
 */
import {
  Box,
  ChakraProvider,
  extendTheme,
  Flex,
  Link,
  useDisclosure,
} from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import Header from "./components/Header/Header";
import SettingsModal from "./components/SettingsModal/SettingsModal";
import "./App.css";
import SVG from "./components/SVG/SVG";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useParameter } from "./hooks/useParameter";
import { useState } from "react";
import { Legend } from "./components/Legend";
import { additionalColorDefaults, pipelineColorDefaults } from "./d3/constants";
import Panel from "./Panel";

// Responsive popover styling. See https://github.com/chakra-ui/chakra-ui/issues/2609
const theme = extendTheme({
  components: {
    Popover: {
      variants: {
        responsive: {
          content: { width: "unset" },
          popper: {
            maxWidth: "unset",
            width: "unset",
          },
        },
      },
    },
  },
});

// TODO: Make this and the parameter hooks nicer.
function bootstrapParameters() {
  const url = new URL(window.location);
  [
    { key: "workspace" },
    { key: "sprint" },
    { key: "epic", parse: (v) => parseInt(v, 10) },
    { key: "appSettings", isObject: true },
    { key: "pipelineColors", isObject: true },
    { key: "additionalColors", isObject: true },
    { key: "pipelineHidden", isObject: true },
    { key: "coordinateOverrides", isObject: true },
  ].forEach(({ key, parse = (v) => v, isObject }) => {
    if (url.searchParams.has(key)) {
      const value = isObject
        ? JSON.parse(url.searchParams.get(key))
        : parse(url.searchParams.get(key));

      // Local storage is always JSON.stringified.
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      const localValue = localStorage.getItem(key);
      if (!localValue) return;

      let parsedValue;
      try {
        parsedValue = JSON.parse(localValue);
      } catch (err) {
        console.log("JSON parse error", err);
      }
      if (parsedValue) {
        url.searchParams.set(
          key,
          isObject ? JSON.stringify(localValue) : localValue
        );
        window.history.pushState({}, undefined, url);
      }
    }
  });
}

bootstrapParameters();

function App({ authentication, panel }) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [APIKey, saveAPIKey] = useLocalStorage("zenhubAPIKey", "");
  const [appSettings, saveAppSettings] = useParameter("appSettings", {});
  const [pipelineColors, savePipelineColors] = useParameter(
    "pipelineColors",
    pipelineColorDefaults
  );
  const [additionalColors, saveAdditionalColors] = useParameter(
    "additionalColors",
    additionalColorDefaults
  );
  // TODO: Merge pipelineColors and pipelineHidden if more pipeline settings are added.
  const [pipelineHidden, savePipelineHidden] = useParameter(
    "pipelineHidden",
    {}
  );
  const [coordinateOverrides, saveCoordinateOverrides] = useParameter(
    `coordinateOverrides`,
    {}
  );
  const [workspace, saveWorkspace] = useParameter("workspace", "");
  const [epic, saveEpic] = useParameter("epic", "");
  const [sprint, saveSprint] = useParameter("sprint", "");
  const [epicIssue, setEpicIssue] = useState(); // TODO: Remove epicIssue if no longer used.
  const [nonEpicIssues, setNonEpicIssues] = useState();
  const [selfContainedIssues, setSelfContainedIssues] = useState();
  const [hiddenIssues, setHiddenIssues] = useState();
  const [currentGraphData, setCurrentGraphData] = useState();

  // TODO: Migrate these to Jotai.
  const sharedStateProps = {
    APIKey,
    saveAPIKey,
    appSettings,
    saveAppSettings,
    pipelineColors,
    savePipelineColors,
    additionalColors,
    saveAdditionalColors,
    pipelineHidden,
    savePipelineHidden,
    coordinateOverrides,
    saveCoordinateOverrides,
    workspace,
    saveWorkspace,
    epic,
    saveEpic,
    sprint,
    saveSprint,
    epicIssue,
    setEpicIssue,
    nonEpicIssues,
    setNonEpicIssues,
    selfContainedIssues,
    setSelfContainedIssues,
    hiddenIssues,
    setHiddenIssues,
    currentGraphData,
    setCurrentGraphData,
  };

  return (
    <ChakraProvider theme={theme}>
      <Box>
        <Header
          APIKey={APIKey}
          appSettings={appSettings}
          pipelineColors={pipelineColors}
          savePipelineColors={savePipelineColors}
          additionalColors={additionalColors}
          saveAdditionalColors={saveAdditionalColors}
          pipelineHidden={pipelineHidden}
          savePipelineHidden={savePipelineHidden}
          onAPIKeyModalOpen={onOpen}
          authentication={authentication}
          panel={panel}
          {...sharedStateProps}
        />
        <Flex direction="row">
          <Box flex="1" id="graph-container">
            {APIKey ? (
              <SVG APIKey={APIKey} {...sharedStateProps} />
            ) : (
              <Box p={4}>
                <p>
                  Please add your <strong>Zenhub API key</strong> in{" "}
                  {authentication ? (
                    <strong>User &gt; Settings</strong>
                  ) : (
                    <strong>Settings</strong>
                  )}
                  .
                </p>
                <p>
                  To generate your Personal API Key, go to the{" "}
                  <Link
                    href="https://app.zenhub.com/settings/tokens"
                    isExternal
                    color="teal.500"
                  >
                    API section of your Zenhub Dashboard
                  </Link>
                  .
                </p>
              </Box>
            )}
          </Box>
          <Panel
            {...sharedStateProps}
            authentication={authentication}
            panel={panel}
          />
        </Flex>
        <SettingsModal
          isOpen={isOpen}
          onClose={onClose}
          {...sharedStateProps}
        />
      </Box>
    </ChakraProvider>
  );
}

export default App;
