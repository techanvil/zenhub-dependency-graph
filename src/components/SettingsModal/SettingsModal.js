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
  FormLabel,
  Switch,
} from "@chakra-ui/react";
import { shallowEqual } from "../../utils/common";

export default function APIKeyModal({
  isOpen,
  onClose,
  APIKey,
  saveAPIKey,
  showAncestorDependencies,
  saveShowAncestorDependencies,
}) {
  const [settingsState, setSettingsState] = useState({
    APIKey: "",
    showAncestorDependencies: false,
  });

  useEffect(() => {
    setSettingsState({
      APIKey,
      showAncestorDependencies,
    });
  }, [APIKey, showAncestorDependencies]);

  const updateSettings = (newSettings) => {
    setSettingsState({
      ...settingsState,
      ...newSettings,
    });
  };

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
        <ModalHeader>Settings</ModalHeader>
        {APIKey !== "" && <ModalCloseButton />}
        <ModalBody>
          <FormControl>
            <FormLabel>Zenhub API Key</FormLabel>
            <Input
              placeholder="API Key"
              value={settingsState.APIKey}
              onChange={(e) => {
                updateSettings({ APIKey: e.target.value });
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
          <FormControl pt="5">
            <FormLabel>Show Ancestor Dependencies</FormLabel>
            <Switch
              isChecked={settingsState.showAncestorDependencies}
              onChange={(e) => {
                updateSettings({ showAncestorDependencies: e.target.checked });
              }}
            />
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            mr={3}
            onClick={() => {
              saveAPIKey(settingsState.APIKey);
              saveShowAncestorDependencies(
                settingsState.showAncestorDependencies
              );

              if (settingsState.APIKey !== "") {
                onClose();
              }
            }}
            disabled={shallowEqual(settingsState, {
              APIKey,
              showAncestorDependencies: !!showAncestorDependencies,
            })}
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
