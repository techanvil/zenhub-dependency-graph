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
import { useState } from "react";

// TODO: Make this and the parameter hooks nicer.
function bootstrapParameters() {
  const url = new URL(window.location);
  ["workspace", "epic"].forEach((key) => {
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
  const [workspace, saveWorkspace] = useParameter("workspace");
  const [epic, saveEpic] = useParameter("epic");
  const [epicIssue, setEpicIssue] = useState();

  // TODO: Provide a nicer state sharing solution.
  const sharedStateProps = {
    APIKey,
    saveAPIKey,
    workspace,
    saveWorkspace,
    epic,
    saveEpic,
    epicIssue,
    setEpicIssue,
  };

  return (
    <Box>
      <Header onAPIKeyModalOpen={onOpen} {...sharedStateProps} />
      <SVG APIKey={APIKey} {...sharedStateProps} />
      <APIKeyModal isOpen={isOpen} onClose={onClose} {...sharedStateProps} />
    </Box>
  );
}

export default App;
