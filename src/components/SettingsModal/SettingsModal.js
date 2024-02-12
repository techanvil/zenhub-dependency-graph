/**
 * External dependencies
 */
import { useEffect, useMemo, useState } from "react";
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
  Text,
} from "@chakra-ui/react";
import { deepEquals, shallowEqual } from "../../utils/common";

export default function APIKeyModal({
  isOpen,
  onClose,
  APIKey,
  saveAPIKey,
  appSettings,
  saveAppSettings,
}) {
  // TODO: Clean this up.
  const appSettingsWithDefaults = useMemo(
    () => ({
      ...{
        showAncestorDependencies: false,
        showIssueDetails: false,
        showNonEpicIssues: false,
        showNonEpicBlockedIssues: false,
        showSelfContainedIssues: false,
      },
      ...appSettings,
    }),
    [appSettings]
  );

  const [settingsState, setSettingsState] = useState({
    APIKey: "",
    appSettings: appSettingsWithDefaults,
  });

  useEffect(() => {
    setSettingsState({
      APIKey,
      appSettings: appSettingsWithDefaults,
    });
  }, [APIKey, appSettings, appSettingsWithDefaults]);

  const updateSettings = (newSettings) => {
    setSettingsState({
      ...settingsState,
      ...newSettings,
    });
  };

  const updateAppSettings = (newAppSettings) => {
    setSettingsState({
      ...settingsState,
      appSettings: {
        ...settingsState.appSettings,
        ...newAppSettings,
      },
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
            <FormLabel>Zenhub API key</FormLabel>
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
            <FormLabel>Show issue details</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.showIssueDetails}
              onChange={(e) => {
                updateAppSettings({
                  showIssueDetails: e.target.checked,
                });
              }}
            />
          </FormControl>
          <FormControl pt="5">
            <FormLabel>Show non-epic issues</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.showNonEpicIssues}
              onChange={(e) => {
                updateAppSettings({
                  showNonEpicIssues: e.target.checked,
                });
              }}
            />
          </FormControl>
          <FormControl pt="5" pb="5">
            <FormLabel>Show self-contained issues</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.showSelfContainedIssues}
              onChange={(e) => {
                updateAppSettings({
                  showSelfContainedIssues: e.target.checked,
                });
              }}
            />
          </FormControl>
          <details>
            <summary>Advanced</summary>

            <FormControl pt="5">
              <FormLabel>
                Show non-epic blocked issues (it's recommended to leave this
                off)
              </FormLabel>
              <Switch
                isChecked={settingsState.appSettings.showNonEpicBlockedIssues}
                onChange={(e) => {
                  updateAppSettings({
                    showNonEpicBlockedIssues: e.target.checked,
                  });
                }}
              />
            </FormControl>
            <FormControl pt="5">
              <FormLabel>
                Show ancestor dependencies (it's recommended to leave this off)
              </FormLabel>
              <Switch
                isChecked={settingsState.appSettings.showAncestorDependencies}
                onChange={(e) => {
                  updateAppSettings({
                    showAncestorDependencies: e.target.checked,
                  });
                }}
              />
            </FormControl>
          </details>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            mr={3}
            onClick={() => {
              saveAPIKey(settingsState.APIKey);
              saveAppSettings(settingsState.appSettings);

              if (settingsState.APIKey !== "") {
                onClose();
              }
            }}
            disabled={deepEquals(settingsState, {
              APIKey,
              appSettings: appSettingsWithDefaults,
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
