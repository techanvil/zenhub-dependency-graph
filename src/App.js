/**
 * External dependencies
 */
import { Box, useDisclosure } from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import Header from "./components/Header/Header";
import APIKeyModal from "./components/APIKeyModal/APIKeyModal";
import "./App.css";
import SVG from "./components/SVG/SVG";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useParameter } from "./hooks/useParameter";

// TODO: Make this and the parameter hooks nicer.
function bootstrapParameters() {
  const url = new URL(window.location);
  ["zenhubWorkspace", "zenhubEpicIssueNumber"].forEach((key) => {
    if (url.searchParams.has(key)) {
      localStorage.setItem(key, url.searchParams.get(key));
    } else {
      const localValue = localStorage.getItem(key);
      if (localValue !== undefined) {
        url.searchParams.set(key, localValue);
        window.history.pushState({}, undefined, url);
      }
    }
  });
}

bootstrapParameters();

function App() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [APIKey, saveAPIKey] = useLocalStorage("zenhubAPIKey");
  const [workspace, saveWorkspace] = useParameter("zenhubWorkspace");
  const [epic, saveEpic] = useParameter("zenhubEpicIssueNumber");

  // TODO: Provide a nicer state sharing solution.
  const localStorageProps = {
    APIKey,
    saveAPIKey,
    workspace,
    saveWorkspace,
    epic,
    saveEpic,
  };

  return (
    <Box>
      <Header onAPIKeyModalOpen={onOpen} {...localStorageProps} />
      <SVG APIKey={APIKey} {...localStorageProps} />
      <APIKeyModal isOpen={isOpen} onClose={onClose} {...localStorageProps} />
    </Box>
  );
}

export default App;
