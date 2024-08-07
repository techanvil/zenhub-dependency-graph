/**
 * External dependencies
 */
import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  Heading,
  HStack,
  Input,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Text,
  useColorModeValue,
  useDisclosure,
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
} from "../../data/graph-data";
import { isEmpty } from "../../utils/common";
import { Legend } from "../Legend";

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
  APIKey,
  appSettings,
  pipelineColors,
  savePipelineColors,
  additionalColors,
  saveAdditionalColors,
  pipelineHidden,
  savePipelineHidden,
  onAPIKeyModalOpen = () => {},
  panel,
  workspace,
  saveWorkspace,
  epic,
  saveEpic,
  sprint,
  saveSprint,
  epicIssue,
  nonEpicIssues,
  selfContainedIssues,
  hiddenIssues,
  currentGraphData,
}) {
  const [organizationOptions, setOrganizationOptions] = useState([]);
  const [chosenOrganization, setChosenOrganization] = useState(false);
  const [chosenWorkspace, setChosenWorkspace] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState(false);
  const [epicOptions, setEpicOptions] = useState([]);
  const [chosenEpic, setChosenEpic] = useState(false);
  const [sprintOptions, setSprintOptions] = useState([]);
  const [chosenSprint, setChosenSprint] = useState(false);

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
    [sprint]
  );

  useEffect(() => {
    if (isEmpty(APIKey)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    getAllOrganizations(
      "https://api.zenhub.com/public/graphql/",
      APIKey,
      signal
    )
      .then((organizations) =>
        setOrganizationOptions(
          organizations.map(entityToOption).sort(sortOptions)
        )
      )
      .catch((err) => {
        console.log("getGraphData error", err);
        setOrganizationOptions([]);
      });

    return () => controller.abort();
  }, [workspace, APIKey]);

  const loadOptions = useCallback(
    async function loadOptions(workspaceName, signal = null) {
      if (isEmpty(workspaceName) || workspaceName.length < 2) {
        return [];
      }

      const workspaces = await getWorkspaces(
        workspaceName,
        "https://api.zenhub.com/public/graphql/",
        APIKey,
        signal
      );

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
            zenhubOrganizationName === chosenOrganization.label
        );
      }

      return options;
    },
    [APIKey, chosenOrganization]
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
            ({ label }) => label === options[0].zenhubOrganizationName
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

    return () => controller.abort();
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

    getAllEpics(
      chosenWorkspace.value,
      "https://api.zenhub.com/public/graphql/",
      APIKey,
      signal
    )
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

    return () => controller.abort();
  }, [APIKey, appSettings.showClosedEpics, chosenWorkspace, epic]);

  const extraWorkspaceProps = chosenOrganization
    ? {
        placeholder: "Enter workspace name",
      }
    : {};

  return (
    <>
      <Box as="section" h="80px">
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
                <FormControl>
                  <Box w="200px">
                    <Select
                      options={epicOptions}
                      value={chosenEpic}
                      onChange={(chosenEpic) => saveEpic(chosenEpic.value)}
                    />
                  </Box>
                </FormControl>
              </HStack>
              <WrapItem alignItems="center">
                <VStack spacing="0">
                  {!appSettings.showNonEpicIssues && nonEpicIssues?.length > 0 && (
                    <Text color="tomato">
                      <b>{nonEpicIssues.length}</b> non-epic{" "}
                      {pluralise(nonEpicIssues.length, "issue", "issues")}{" "}
                      hidden (<b>{getOpenIssueCount(nonEpicIssues)}</b> open)
                    </Text>
                  )}
                  {!appSettings.showSelfContainedIssues &&
                    selfContainedIssues?.length > 0 && (
                      <Text color="tomato">
                        <b>{selfContainedIssues.length}</b> self-contained{" "}
                        {pluralise(
                          selfContainedIssues.length,
                          "issue",
                          "issues"
                        )}{" "}
                        hidden (<b>{getOpenIssueCount(selfContainedIssues)}</b>{" "}
                        open)
                      </Text>
                    )}
                  {hiddenIssues?.length > 0 && (
                    <Text color="tomato">
                      <b>{hiddenIssues.length}</b>{" "}
                      {pluralise(hiddenIssues.length, "issue", "issues")} hidden
                      by pipeline (<b>{getOpenIssueCount(hiddenIssues)}</b>{" "}
                      open)
                    </Text>
                  )}
                </VStack>
              </WrapItem>
              <WrapItem spacing="3">
                <Button colorScheme="blue" mr={3} onClick={onAPIKeyModalOpen}>
                  Settings
                </Button>
                <Popover placement="bottom">
                  <PopoverTrigger>
                    <Button colorScheme="blue" mr={3}>
                      Legend
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <PopoverArrow />
                    <PopoverCloseButton />
                    <PopoverHeader>Issue state</PopoverHeader>
                    <PopoverBody>
                      <Legend
                        pipelineColors={pipelineColors}
                        savePipelineColors={savePipelineColors}
                        additionalColors={additionalColors}
                        saveAdditionalColors={saveAdditionalColors}
                        pipelineHidden={pipelineHidden}
                        savePipelineHidden={savePipelineHidden}
                      />
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
                {panel && (
                  <PanelPopover {...panel} graphData={currentGraphData} />
                )}
              </WrapItem>
            </Wrap>
          </Container>
        </Box>
      </Box>
    </>
  );
}

function PanelPopover({ buttonTitle, PanelComponent, graphData }) {
  const { isOpen, onToggle, onClose } = useDisclosure({
    defaultIsOpen: true,
  });

  return (
    <Popover
      placement="bottom-end"
      isOpen={isOpen}
      onClose={onClose}
      variant="responsive" // See theme in App.js.
    >
      <PopoverTrigger>
        <Button colorScheme="blue" mr={3} onClick={onToggle}>
          {buttonTitle}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverArrow />
        <PopoverCloseButton />
        {/* <PopoverHeader>Insert</PopoverHeader> */}
        <PopoverBody>
          <PanelComponent graphData={graphData} />
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
