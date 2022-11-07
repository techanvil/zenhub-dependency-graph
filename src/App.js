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

function App() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box>
      <Header onAPIKeyModalOpen={onOpen} />
      <SVG />
      <APIKeyModal isOpen={isOpen} onClose={onClose} />
    </Box>
  );
}

export default App;
