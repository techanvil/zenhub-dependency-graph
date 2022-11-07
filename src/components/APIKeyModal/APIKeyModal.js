/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import {
  Button,
  FormControl,
  FormHelperText,
  Link,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import { useLocalStorage } from "../../hooks/useLocalStorage";

export default function APIKeyModal({ isOpen, onClose }) {
  const [savedAPIKey, saveAPIKey] = useLocalStorage("zenhubAPIKey", "");
  const [APIKey, setAPIKey] = useState("");

  useEffect(() => {
    setAPIKey(savedAPIKey);
  }, [savedAPIKey]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (savedAPIKey !== "") {
          onClose();
        }
      }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Zenhub API Key</ModalHeader>
        {savedAPIKey !== "" && <ModalCloseButton />}
        <ModalBody>
          <FormControl>
            <Input
              placeholder="API Key"
              value={APIKey}
              onChange={(e) => {
                setAPIKey(e.target.value);
              }}
            />
            <FormHelperText>
              To generate your Personal API Key, go to the{" "}
              <Link
                href="https://app.zenhub.com/settings/tokens"
                isExternal
                color="teal.500"
              >
                API section of your Zenhub Dashboard
              </Link>
              .
            </FormHelperText>
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            mr={3}
            onClick={() => {
              saveAPIKey(APIKey);

              if (APIKey !== "") {
                onClose();
              }
            }}
            disabled={APIKey === savedAPIKey}
          >
            Save
          </Button>
          {savedAPIKey !== "" && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
