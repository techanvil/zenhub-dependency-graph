/**
 * External dependencies
 */
import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
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
import { deepEquals } from "../../utils/common";
import {
  additionalColorDefaults,
  pipelineColorDefaults,
} from "../../d3/constants";
import { appSettingDefaults } from "../../constants";
import {
  additionalColorsAtom,
  APIKeyAtom,
  appSettingsAtom,
  coordinateOverridesAtom,
  pipelineColorsAtom,
  pipelineHiddenAtom,
} from "../../store/atoms";
import { clearGraphCache } from "../../data/graph-data";

export default function SettingsModal({ isOpen, onClose }) {
  const [APIKey, saveAPIKey] = useAtom(APIKeyAtom);
  const [appSettings, saveAppSettings] = useAtom(appSettingsAtom);
  const [pipelineColors, savePipelineColors] = useAtom(pipelineColorsAtom);
  const [additionalColors, saveAdditionalColors] =
    useAtom(additionalColorsAtom);
  const [pipelineHidden, savePipelineHidden] = useAtom(pipelineHiddenAtom);
  const [coordinateOverrides, saveCoordinateOverrides] = useAtom(
    coordinateOverridesAtom,
  );

  // TODO: Clean this up.
  const appSettingsWithDefaults = useMemo(
    () => ({
      ...appSettingDefaults,
      ...appSettings,
    }),
    [appSettings],
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
            <FormLabel>Snap to grid</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.snapToGrid}
              onChange={(e) => {
                updateAppSettings({
                  snapToGrid: e.target.checked,
                });
              }}
            />
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
          <FormControl pt="5">
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
          <FormControl pt="5">
            <FormLabel>Show closed epics</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.showClosedEpics}
              onChange={(e) => {
                updateAppSettings({
                  showClosedEpics: e.target.checked,
                });
              }}
            />
          </FormControl>
          <FormControl pt="5">
            <FormLabel>Show issue estimates</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.showIssueEstimates}
              onChange={(e) => {
                updateAppSettings({
                  showIssueEstimates: e.target.checked,
                });
              }}
            />
          </FormControl>
          <FormControl pt="5">
            <FormLabel>Show issue sprints</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.showIssueSprints}
              onChange={(e) => {
                updateAppSettings({
                  showIssueSprints: e.target.checked,
                });
              }}
            />
          </FormControl>
          <FormControl pt="5">
            <FormLabel>Highlight blocked & blocking issues</FormLabel>
            <Switch
              isChecked={settingsState.appSettings.highlightRelatedIssues}
              onChange={(e) => {
                updateAppSettings({
                  highlightRelatedIssues: e.target.checked,
                });
              }}
            />
          </FormControl>
          <FormControl pt="5">
            <FormLabel>Include background when exporting graph</FormLabel>
            <Switch
              isChecked={
                settingsState.appSettings.includeBackgroundWhenExporting
              }
              onChange={(e) => {
                updateAppSettings({
                  includeBackgroundWhenExporting: e.target.checked,
                });
              }}
            />
          </FormControl>
          {Object.keys(coordinateOverrides || {}).length > 0 && (
            <FormControl pt="5">
              <FormLabel>
                Reset epic layout (takes effect immediately)
              </FormLabel>
              <Button
                colorScheme="blue"
                mr={1}
                onClick={() => {
                  saveCoordinateOverrides(null);
                }}
              >
                Reset layout
              </Button>
            </FormControl>
          )}
          {!(
            deepEquals(pipelineColors, pipelineColorDefaults) &&
            deepEquals(additionalColors, additionalColorDefaults)
          ) && (
            <FormControl pt="5">
              <FormLabel>
                Reset issue colours (takes effect immediately)
              </FormLabel>
              <Button
                colorScheme="blue"
                mr={1}
                onClick={() => {
                  savePipelineColors(pipelineColorDefaults);
                  saveAdditionalColors(additionalColorDefaults);
                }}
              >
                Reset colours
              </Button>
            </FormControl>
          )}
          {Object.keys(pipelineHidden).length > 0 && (
            <FormControl pt="5">
              <FormLabel>
                Unhide all pipelines (takes effect immediately)
              </FormLabel>
              <Button
                colorScheme="blue"
                mr={1}
                onClick={() => {
                  savePipelineHidden({});
                }}
              >
                Unhide pipelines
              </Button>
            </FormControl>
          )}
          <FormControl pt="5" pb="5">
            <FormLabel>
              Flush request cache (takes effect immediately)
            </FormLabel>
            <Button
              colorScheme="blue"
              mr={1}
              onClick={() => {
                clearGraphCache();
              }}
            >
              Flush cache
            </Button>
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
