/**
 * External dependencies
 */
import { useCallback, useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  Box,
  Button,
  Container,
  FormControl,
  Heading,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Switch,
  Text,
  useColorModeValue,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { AsyncSelect, Select } from "chakra-react-select";

/**
 * Internal dependencies
 */
import {
  getAllOrganizations,
  getAllEpics,
  getWorkspaces,
  getEpicInfo,
} from "../../data/graph-data";
import { isEmpty } from "../../utils/common";
import {
  activePaneAtom,
  APIKeyAtom,
  appSettingsAtom,
  epicAtom,
  hiddenIssuesAtom,
  isManualEpicAtom,
  nonEpicIssuesAtom,
  PANES,
  selfContainedIssuesAtom,
  sprintAtom,
  workspaceAtom,
} from "../../store/atoms";
import { copyPNG, downloadSVG } from "../../utils/svg";

function pluralise(count, singular, plural) {
  return count === 1 ? singular : plural;
}

function sortOptions({ label: a }, { label: b }) {
  return a.localeCompare(b);
}

function entityToOption({ name, id }) {
  return { label: name, value: id };
}

function getOpenIssueCount(issues) {
  return issues.filter(({ pipelineName }) => pipelineName !== "Closed").length;
}

export default function Header({
  onAPIKeyModalOpen = () => {},
  authentication,
  panel,
}) {
  const [organizationOptions, setOrganizationOptions] = useState([]);
  const [chosenOrganization, setChosenOrganization] = useState(false);
  const [chosenWorkspace, setChosenWorkspace] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState(false);
  const [epicOptions, setEpicOptions] = useState([]);
  const [chosenEpic, setChosenEpic] = useState(false);
  const isManualEpic = useAtomValue(isManualEpicAtom);
  const [sprintOptions, setSprintOptions] = useState([]);
  const [chosenSprint, setChosenSprint] = useState(false);

  const nonEpicIssues = useAtomValue(nonEpicIssuesAtom);
  const selfContainedIssues = useAtomValue(selfContainedIssuesAtom);
  const hiddenIssues = useAtomValue(hiddenIssuesAtom);
  const [activePane, setActivePane] = useAtom(activePaneAtom);

  const APIKey = useAtomValue(APIKeyAtom);
  const appSettings = useAtomValue(appSettingsAtom);
  const [workspace, saveWorkspace] = useAtom(workspaceAtom);
  const [epic, saveEpic] = useAtom(epicAtom);
  const [sprint, saveSprint] = useAtom(sprintAtom);

  const setChosenWorkspaceAndSprint = useCallback(
    (workspace) => {
      setChosenWorkspace(workspace);

      if (workspace === false) {
        setSprintOptions([]);
        setChosenSprint(false);
        return;
      }

      const sprintOptions = workspace.sprints
        .map(({ name, id: value }) => ({
          name,
          label:
            name === workspace.activeSprint?.name ? `${name} (current)` : name,
          value,
        }))
        .sort(sortOptions);

      setSprintOptions(sprintOptions);

      const currentSprint = sprintOptions.find(({ name }) => name === sprint);
      if (currentSprint) {
        setChosenSprint(currentSprint);
      } else {
        setChosenSprint(false);
      }
    },
    [sprint],
  );

  useEffect(() => {
    if (isEmpty(APIKey)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    getAllOrganizations(signal)
      .then((organizations) =>
        setOrganizationOptions(
          organizations.map(entityToOption).sort(sortOptions),
        ),
      )
      .catch((err) => {
        console.log("getGraphData error", err);
        setOrganizationOptions([]);
      });

    return () => controller.abort("getAllOrganizations");
  }, [workspace, APIKey]);

  const loadOptions = useCallback(
    async function loadOptions(workspaceName, signal = null) {
      if (isEmpty(workspaceName) || workspaceName.length < 2) {
        return [];
      }

      const workspaces = await getWorkspaces(workspaceName, signal);

      let options = workspaces
        .map(({ name, id, zenhubOrganizationName, sprints, activeSprint }) => ({
          label: `${name} (${zenhubOrganizationName})`,
          value: id,
          name,
          zenhubOrganizationName,
          sprints,
          activeSprint,
        }))
        .sort(sortOptions);

      if (chosenOrganization) {
        options = options.filter(
          ({ zenhubOrganizationName }) =>
            zenhubOrganizationName === chosenOrganization.label,
        );
      }

      return options;
    },
    [chosenOrganization],
  );

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(workspace)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    loadOptions(workspace, signal)
      .then((options) => {
        setWorkspaceOptions(options);

        if (options.length === 1) {
          setChosenWorkspaceAndSprint(options[0]);

          const organization = organizationOptions.find(
            ({ label }) => label === options[0].zenhubOrganizationName,
          );

          if (organization) {
            setChosenOrganization(organization);
          }
        }
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setWorkspaceOptions([]);
      });

    return () => controller.abort("loadOptions");
  }, [
    APIKey,
    organizationOptions,
    loadOptions,
    workspace,
    setChosenWorkspaceAndSprint,
  ]);

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(chosenWorkspace)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    getAllEpics(chosenWorkspace.value, signal)
      .then((epics) => {
        const visibleEpics = appSettings.showClosedEpics
          ? epics
          : epics.filter(({ closedAt }) => closedAt === null);

        const options = visibleEpics
          .map(({ title: label, number: value }) => ({
            label,
            value,
          }))
          .sort(sortOptions);

        const currentEpic = options.find(({ value }) => value === epic);
        if (currentEpic) {
          setChosenEpic(currentEpic);
        }

        setEpicOptions(options);
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setEpicOptions([]);
      });

    return () => controller.abort("getAllEpics");
  }, [APIKey, appSettings.showClosedEpics, chosenWorkspace, epic]);

  const extraWorkspaceProps = chosenOrganization
    ? {
        placeholder: "Enter workspace name",
      }
    : {};

  function setPane(pane) {
    const newPane = activePane === pane ? PANES.NONE : pane;
    setActivePane(newPane);
  }

  return (
    <>
      <Box as="section" h="var(--header-height)">
        <Box
          as="nav"
          bg="bg-surface"
          boxShadow={useColorModeValue("sm", "sm-dark")}
        >
          <Container py={{ base: "4", lg: "5" }} maxW="100%">
            <Wrap justify="space-between" overflow="visible">
              <WrapItem alignItems="center">
                <Heading as="h4" size="md" title="Zenhub Dependency Graph">
                  ZDG
                </Heading>
              </WrapItem>
              <HStack>
                <FormControl>
                  <Box w="200px">
                    <Select
                      options={organizationOptions}
                      value={chosenOrganization}
                      onChange={(organization) => {
                        setChosenOrganization(organization);
                        setWorkspaceOptions([]);
                        setChosenWorkspaceAndSprint(false);
                        saveWorkspace(false);
                        setEpicOptions([]);
                        setChosenEpic(false);
                        saveEpic(false);
                      }}
                    />
                  </Box>
                </FormControl>
                <FormControl>
                  <Box w="200px">
                    <AsyncSelect
                      // cacheOptions
                      loadOptions={(workspaceName) =>
                        loadOptions(workspaceName)
                      }
                      defaultOptions={workspaceOptions}
                      value={chosenWorkspace}
                      onChange={(workspace) => {
                        setChosenWorkspaceAndSprint(workspace);
                        saveWorkspace(workspace.name);
                      }}
                      {...extraWorkspaceProps}
                    />
                  </Box>
                </FormControl>
                <FormControl>
                  <Box w="200px">
                    <Select
                      options={sprintOptions}
                      value={chosenSprint}
                      onChange={(chosenSprint) => {
                        console.log({ chosenSprint });
                        saveSprint(chosenSprint.name);
                      }}
                    />
                  </Box>
                </FormControl>
                <SelectEpicControl
                  epicOptions={epicOptions}
                  chosenEpic={chosenEpic}
                  setChosenEpic={setChosenEpic}
                />
              </HStack>
              <WrapItem>
                {isManualEpic && chosenEpic && (
                  <Text fontSize="smaller" alignSelf="center">
                    {chosenEpic.label}
                  </Text>
                )}
              </WrapItem>
              <WrapItem
                alignItems="center"
                maxH="36px" // Hack to avoid expanding the header height
                overflow="visible" // when there are three lines of text.
              >
                <VStack spacing="0">
                  {!appSettings.showNonEpicIssues &&
                    nonEpicIssues?.length > 0 && (
                      <Text color="tomato" fontSize="small">
                        <b>{nonEpicIssues.length}</b> non-epic{" "}
                        {pluralise(nonEpicIssues.length, "issue", "issues")}{" "}
                        hidden (<b>{getOpenIssueCount(nonEpicIssues)}</b> open)
                      </Text>
                    )}
                  {!appSettings.showSelfContainedIssues &&
                    selfContainedIssues?.length > 0 && (
                      <Text color="tomato" fontSize="small">
                        <b>{selfContainedIssues.length}</b> self-contained{" "}
                        {pluralise(
                          selfContainedIssues.length,
                          "issue",
                          "issues",
                        )}{" "}
                        hidden (<b>{getOpenIssueCount(selfContainedIssues)}</b>{" "}
                        open)
                      </Text>
                    )}
                  {hiddenIssues?.length > 0 && (
                    <Text color="tomato" fontSize="small">
                      <b>{hiddenIssues.length}</b>{" "}
                      {pluralise(hiddenIssues.length, "issue", "issues")} hidden
                      by pipeline (<b>{getOpenIssueCount(hiddenIssues)}</b>{" "}
                      open)
                    </Text>
                  )}
                </VStack>
              </WrapItem>
              <WrapItem spacing="3">
                {/* <Button colorScheme="blue" mr={3} onClick={onAPIKeyModalOpen}>
                  Settings
                </Button> */}
                <Button
                  colorScheme="blue"
                  mr={3}
                  onClick={() => setPane(PANES.LEGEND)}
                >
                  Legend
                </Button>
                {panel && (
                  <Button
                    colorScheme="blue"
                    mr={3}
                    onClick={() => setPane(PANES.EXTERNAL)}
                  >
                    {panel.buttonTitle}
                  </Button>
                )}
                <Menu>
                  <MenuButton as={Button} colorScheme="blue">
                    {/*rightIcon={<ChevronDownIcon />}> */}
                    Menu
                  </MenuButton>
                  <MenuList>
                    {authentication && (
                      <AuthenticationMenuItem authentication={authentication} />
                    )}
                    <MenuItem onClick={onAPIKeyModalOpen}>Settings</MenuItem>
                    <MenuItem
                      onClick={() =>
                        downloadSVG(chosenEpic.label, {
                          includeBackground:
                            appSettings.includeBackgroundWhenExporting,
                        })
                      }
                    >
                      Download (SVG)
                    </MenuItem>
                    <MenuItem
                      onClick={() =>
                        copyPNG({
                          includeBackground:
                            appSettings.includeBackgroundWhenExporting,
                        })
                      }
                    >
                      Copy to clipboard (PNG)
                    </MenuItem>
                  </MenuList>
                </Menu>
              </WrapItem>
            </Wrap>
          </Container>
        </Box>
      </Box>
    </>
  );
}

function AuthenticationMenuItem({ authentication }) {
  if (!authentication) {
    return null;
  }

  if (authentication.session) {
    return (
      <MenuItem onClick={authentication.signOut}>
        <img
          style={{
            width: "2em",
            height: "2em",
            marginRight: "0.5em",
            borderRadius: "50%",
          }}
          src={authentication.session.user.image}
          alt={authentication.session.user.name}
        />
        {authentication.signOutLabel || "Sign out"}
      </MenuItem>
    );
  }

  return (
    <MenuItem onClick={authentication.signIn}>
      {authentication.signInLabel || "Sign in"}
    </MenuItem>
  );
}

function SelectEpicControl({ epicOptions, chosenEpic, setChosenEpic }) {
  const workspace = useAtomValue(workspaceAtom);
  const [isManualEpic, setIsManualEpic] = useAtom(isManualEpicAtom);
  const [epic, saveEpic] = useAtom(epicAtom);
  const [epicNumber, setEpicNumber] = useState(chosenEpic?.value || epic);
  const [isSaving, setIsSaving] = useState(false);

  const updateChosenEpic = useCallback(
    async (epicNum) => {
      if (!epicNum || epicNum === chosenEpic?.value) {
        return;
      }

      setIsSaving(true);

      // TODO: Can we use the URQL React hook to do this?
      const issueByNumberResult = await getEpicInfo(
        workspace,
        // TODO: Improve the string/number handling.
        Number(epicNum),
      );
      const newChosenEpic = {
        label: issueByNumberResult.title,
        value: epicNum,
      };
      setChosenEpic(newChosenEpic);

      setIsSaving(false);
    },
    [chosenEpic?.value, workspace, setChosenEpic],
  );

  async function saveManuallySelectedEpic(epicNumber) {
    setIsSaving(true);

    // TODO: Improve the string/number handling.
    saveEpic(Number(epicNumber));
    setIsSaving(false);

    updateChosenEpic(epicNumber);
  }

  useEffect(() => {
    if (isManualEpic && workspace && epic && !chosenEpic) {
      updateChosenEpic(epic);
    }
  }, [chosenEpic, epic, isManualEpic, updateChosenEpic, workspace]);

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <FormControl>
        {isManualEpic ? (
          <Input
            placeholder="Epic issue #, then Enter"
            type="number"
            w="180px"
            disabled={isSaving}
            value={epicNumber}
            onChange={(e) => setEpicNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                saveManuallySelectedEpic(epicNumber);
              }
            }}
          />
        ) : (
          <Box w="200px">
            <Select
              options={epicOptions}
              value={chosenEpic}
              onChange={(chosenEpic) => {
                // Clear the coordinate overrides from the query string when changing epics,
                // so the coords for the new epic can be loaded from localStorage.
                // TODO, a big refactor is needed to handle params and state better.

                const url = new URL(window.location);
                url.searchParams.delete("coordinateOverrides");
                window.history.pushState({}, undefined, url);

                saveEpic(chosenEpic.value);
              }}
            />
          </Box>
        )}
      </FormControl>
      <Switch
        title="Enable manual epic input"
        isChecked={
          // FIXME: Fix this string/boolean handling.
          typeof isManualEpic === "boolean"
            ? isManualEpic
            : isManualEpic === "true"
        }
        onChange={(e) => {
          setIsManualEpic(e.target.checked);
        }}
      />
    </Box>
  );
}
