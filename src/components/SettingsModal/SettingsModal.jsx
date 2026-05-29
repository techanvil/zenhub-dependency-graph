/**
 * External dependencies
 */
import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import {
  Button,
  FormControl,
  FormHelperText,
  HStack,
  Heading,
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
  Radio,
  RadioGroup,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from "@chakra-ui/react";
import { deepEquals } from "../../utils/common";
import { appSettingDefaults } from "../../constants";
import {
  APIKeyAtom,
  appSettingsAtom,
  colorModePreferenceAtom,
} from "../../store/atoms";
import { clearGraphCache } from "../../data/graph-data";

function SwitchSetting({ label, settingKey, settings, onChange }) {
  return (
    <FormControl pt="4">
      <FormLabel mb="1">{label}</FormLabel>
      <Switch
        isChecked={settings[settingKey]}
        onChange={(e) => onChange({ [settingKey]: e.target.checked })}
      />
    </FormControl>
  );
}

function SectionHeading({ children }) {
  return (
    <Heading size="xs" textTransform="uppercase" letterSpacing="wide" mb="2" mt="4" opacity="0.6">
      {children}
    </Heading>
  );
}

export default function SettingsModal({ isOpen, onClose }) {
  const [APIKey, saveAPIKey] = useAtom(APIKeyAtom);
  const [appSettings, saveAppSettings] = useAtom(appSettingsAtom);
  const [colorModePreference, setColorModePreference] = useAtom(
    colorModePreferenceAtom,
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

  const s = settingsState.appSettings;

  return (
    <Modal
      isOpen={isOpen}
      size="xl"
      scrollBehavior="inside"
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
        <ModalBody px="0" pb="0">
          <Tabs colorScheme="blue" isLazy>
            <TabList px="6">
              <Tab>General</Tab>
              <Tab>Display</Tab>
              <Tab>Canvas &amp; Export</Tab>
              <Tab>Maintenance</Tab>
              <Tab>Advanced</Tab>
            </TabList>

            <TabPanels>
              {/* General */}
              <TabPanel>
                <SectionHeading>Connection</SectionHeading>
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

                <SectionHeading>Appearance</SectionHeading>
                <FormControl pt="2">
                  <FormLabel>Theme (takes effect immediately)</FormLabel>
                  <RadioGroup
                    value={colorModePreference}
                    onChange={setColorModePreference}
                  >
                    <HStack spacing="24px">
                      <Radio value="light">Light</Radio>
                      <Radio value="dark">Dark</Radio>
                      <Radio value="system">System</Radio>
                    </HStack>
                  </RadioGroup>
                </FormControl>
              </TabPanel>

              {/* Display */}
              <TabPanel>
                <SectionHeading>Graph contents</SectionHeading>
                <SwitchSetting
                  label="Show non-epic issues"
                  settingKey="showNonEpicIssues"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Show self-contained issues"
                  settingKey="showSelfContainedIssues"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Show closed epics"
                  settingKey="showClosedEpics"
                  settings={s}
                  onChange={updateAppSettings}
                />

                <SectionHeading>Issue card details</SectionHeading>
                <SwitchSetting
                  label="Show issue details"
                  settingKey="showIssueDetails"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Show issue estimates"
                  settingKey="showIssueEstimates"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Show issue sprints"
                  settingKey="showIssueSprints"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Show issue previews"
                  settingKey="showIssuePreviews"
                  settings={s}
                  onChange={updateAppSettings}
                />
              </TabPanel>

              {/* Canvas & Export */}
              <TabPanel>
                <SectionHeading>Canvas &amp; interaction</SectionHeading>
                <SwitchSetting
                  label="Snap to grid"
                  settingKey="snapToGrid"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Highlight blocked &amp; blocking issues"
                  settingKey="highlightRelatedIssues"
                  settings={s}
                  onChange={updateAppSettings}
                />

                <SectionHeading>Export</SectionHeading>
                <SwitchSetting
                  label="Include background when exporting graph"
                  settingKey="includeBackgroundWhenExporting"
                  settings={s}
                  onChange={updateAppSettings}
                />
              </TabPanel>

              {/* Maintenance */}
              <TabPanel>


                <FormControl pt="4" pb="4">
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
              </TabPanel>

              {/* Advanced */}
              <TabPanel>
                <SwitchSetting
                  label="Show grid"
                  settingKey="showGrid"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Show non-epic blocked issues (it's recommended to leave this off)"
                  settingKey="showNonEpicBlockedIssues"
                  settings={s}
                  onChange={updateAppSettings}
                />
                <SwitchSetting
                  label="Show ancestor dependencies (it's recommended to leave this off)"
                  settingKey="showAncestorDependencies"
                  settings={s}
                  onChange={updateAppSettings}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
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
