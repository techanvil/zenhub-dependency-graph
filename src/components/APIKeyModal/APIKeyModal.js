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

export default function APIKeyModal({ isOpen, onClose, APIKey, saveAPIKey }) {
  const [APIKeyState, setAPIKeyState] = useState("");

  useEffect(() => {
    setAPIKeyState(APIKey);
  }, [APIKey]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (APIKey !== "") {
          onClose();
        }
      }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Zenhub API Key</ModalHeader>
        {APIKey !== "" && <ModalCloseButton />}
        <ModalBody>
          <FormControl>
            <Input
              placeholder="API Key"
              value={APIKeyState}
              onChange={(e) => {
                setAPIKeyState(e.target.value);
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
              saveAPIKey(APIKeyState);

              if (APIKeyState !== "") {
                onClose();
              }
            }}
            disabled={APIKeyState === APIKey}
          >
            Save
          </Button>
          {APIKey !== "" && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
