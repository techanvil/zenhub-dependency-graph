/**
 * External dependencies
 */
import { Box, Flex, Link, useDisclosure } from "@chakra-ui/react";

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

// TODO: Make this and the parameter hooks nicer.
function bootstrapParameters() {
  const url = new URL(window.location);
  [
    { key: "workspace" },
    { key: "sprint" },
    { key: "epic", parse: (v) => parseInt(v, 10) },
  ].forEach(({ key, parse = (v) => v }) => {
    if (url.searchParams.has(key)) {
      // Local storage is always JSON.stringified.
      localStorage.setItem(
        key,
        JSON.stringify(parse(url.searchParams.get(key)))
      );
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
        url.searchParams.set(key, localValue);
        window.history.pushState({}, undefined, url);
      }
    }
  });
}

bootstrapParameters();

function App() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [APIKey, saveAPIKey] = useLocalStorage("zenhubAPIKey", "");
  const [appSettings, saveAppSettings] = useLocalStorage("appSettings", {});
  const [workspace, saveWorkspace] = useParameter("workspace", "");
  const [epic, saveEpic] = useParameter("epic", "");
  const [sprint, saveSprint] = useParameter("sprint", "");
  const [epicIssue, setEpicIssue] = useState(); // TODO: Remove epicIssue if no longer used.
  const [nonEpicIssues, setNonEpicIssues] = useState();
  const [selfContainedIssues, setSelfContainedIssues] = useState();

  // TODO: Provide a proper state sharing solution.
  const sharedStateProps = {
    APIKey,
    saveAPIKey,
    appSettings,
    saveAppSettings,
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
  };

  return (
    <Box>
      <Header
        APIKey={APIKey}
        appSettings={appSettings}
        onAPIKeyModalOpen={onOpen}
        {...sharedStateProps}
      />
      <Flex direction="row">
        <Box flex="1">
          {APIKey ? (
            <SVG APIKey={APIKey} {...sharedStateProps} />
          ) : (
            <Box p={4}>
              <p>
                Please add your <strong>Zenhub API key</strong> in{" "}
                <strong>Settings</strong>.
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
        {/* TODO: Optional inline legend...
        <Box flex="0 0 250px">
          <Legend />
        </Box>
        */}
      </Flex>
      <SettingsModal isOpen={isOpen} onClose={onClose} {...sharedStateProps} />
    </Box>
  );
}

export default App;
