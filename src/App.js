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

function App() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [APIKey, saveAPIKey] = useLocalStorage("zenhubAPIKey");
  const [workspace, saveWorkspace] = useLocalStorage("zenhubWorkspace");
  const [epic, saveEpic] = useLocalStorage("zenhubEpicIssueNumber");

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
