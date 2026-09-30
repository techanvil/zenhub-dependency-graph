/**
 * External dependencies
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Container,
  FormControl,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { AsyncSelect, CreatableSelect, Select } from "chakra-react-select";

/**
 * Internal dependencies
 */
import {
  clearGraphCache,
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
  baselineGraphDataAtom,
  coordinateOverridesAtom,
  currentGraphDataAtom,
  epicAtom,
  focusedIssueIdAtom,
  graphRenderNonceAtom,
  hiddenIssuesAtom,
  nonEpicIssuesAtom,
  PANES,
  selfContainedIssuesAtom,
  sprintAtom,
  workspaceAtom,
} from "../../store/atoms";
import { copyPNG, downloadSVG } from "../../utils/svg";
import PageTitle from "../PageTitle";
import {
  applyPendingDependencyOps,
  computePendingDependencyOps,
} from "../../data/dependency-changes";
import { removeAncestors } from "../../d3";
import { cloneGraphData } from "../../utils/clone-graph-data";

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

function usePageTitle(title) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);
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
  const baselineGraphData = useAtomValue(baselineGraphDataAtom);
  const currentGraphData = useAtomValue(currentGraphDataAtom);
  const setBaselineGraphData = useSetAtom(baselineGraphDataAtom);
  const bumpGraphRenderNonce = useSetAtom(graphRenderNonceAtom);

  const [coordinateOverrides, saveCoordinateOverrides] = useAtom(
    coordinateOverridesAtom,
  );

  const toast = useToast();
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);

  const {
    isOpen: isResetLayoutOpen,
    onOpen: onResetLayoutOpen,
    onClose: onResetLayoutClose,
  } = useDisclosure();
  const resetLayoutCancelRef = useRef();

  const {
    isOpen: isFlushCacheOpen,
    onOpen: onFlushCacheOpen,
    onClose: onFlushCacheClose,
  } = useDisclosure();
  const flushCacheCancelRef = useRef();

  const {
    isOpen: isFindIssueOpen,
    onOpen: onFindIssueOpen,
    onClose: onFindIssueClose,
  } = useDisclosure();

  const hasGraphData = currentGraphData?.length > 0;
  const [focusedIssueId, setFocusedIssueId] = useAtom(focusedIssueIdAtom);

  // Ctrl-F opens the issue search in place of the browser's find, as the graph
  // is an SVG that the browser's find can't navigate. Escape closes the search,
  // or clears the found issue's highlight when the search isn't open.
  useEffect(() => {
    if (!hasGraphData) {
      return;
    }

    function onKeyDown(e) {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        onFindIssueOpen();
        return;
      }

      // Other dialogs stop Escape propagating, so this won't also clear the
      // highlight when Escape is used to close them.
      if (e.key === "Escape") {
        if (isFindIssueOpen) {
          onFindIssueClose();
        } else {
          setFocusedIssueId(null);
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    hasGraphData,
    isFindIssueOpen,
    onFindIssueOpen,
    onFindIssueClose,
    setFocusedIssueId,
  ]);

  let baseline;
  if (appSettings.showAncestorDependencies) {
    baseline = baselineGraphData;
  } else if (baselineGraphData) {
    baseline = cloneGraphData(baselineGraphData);
    removeAncestors(baseline);
  }

  const { ops: pendingOps } = computePendingDependencyOps(
    baseline,
    currentGraphData,
  );

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
        .map(
          ({
            name,
            id,
            zenhubOrganizationId,
            zenhubOrganizationName,
            sprints,
            activeSprint,
          }) => ({
            label: `${name} (${zenhubOrganizationName})`,
            value: id,
            name,
            zenhubOrganizationId,
            zenhubOrganizationName,
            sprints,
            activeSprint,
          }),
        )
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
    if (
      isEmpty(APIKey) ||
      isEmpty(chosenWorkspace) ||
      isEmpty(chosenWorkspace.zenhubOrganizationId)
    ) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    getAllEpics(
      chosenWorkspace.value,
      chosenWorkspace.zenhubOrganizationId,
      signal,
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

        setEpicOptions(options);

        const currentEpic = options.find(({ value }) => value === epic);
        if (currentEpic) {
          setChosenEpic(currentEpic);
          return;
        }

        if (!epic) {
          return;
        }

        // The epic isn't in the list (e.g. it was entered by issue number, or
        // is closed and closed epics are hidden), so look it up directly.
        getEpicInfo(workspace, epic, signal)
          .then((epicInfo) => {
            setChosenEpic({
              label: epicInfo?.title ?? `#${epic}`,
              value: epic,
            });
          })
          .catch((err) => {
            console.log("getEpicInfo error", err);
          });
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setEpicOptions([]);
      });

    return () => controller.abort("getAllEpics");
  }, [APIKey, appSettings.showClosedEpics, chosenWorkspace, epic, workspace]);

  const extraWorkspaceProps = chosenOrganization
    ? {
        placeholder: "Enter workspace name",
      }
    : {};

  function setPane(pane) {
    const newPane = activePane === pane ? PANES.NONE : pane;
    setActivePane(newPane);
  }

  usePageTitle(chosenEpic ? `Epic: ${chosenEpic.label} - ZDG` : "ZDG");

  async function onApplyChanges() {
    if (isApplyingChanges) return;
    if (!pendingOps.length) return;
    if (!baselineGraphData?.length || !currentGraphData?.length) return;

    setIsApplyingChanges(true);
    try {
      const { nextBaseline, appliedCount, totalCount } =
        await applyPendingDependencyOps({
          baseline: baselineGraphData,
          current: currentGraphData,
          ops: pendingOps,
        });

      // Clear pending by treating the now-applied graph as baseline.
      // (We use the updated baseline derived from applied operations, so retries don't re-send.)
      setBaselineGraphData(nextBaseline);
      // After all ops have been successfully applied, redraw using in-memory graph state.
      if (appliedCount === totalCount) {
        bumpGraphRenderNonce((n) => (typeof n === "number" ? n + 1 : 1));
      }

      toast({
        title: "Applied changes",
        description:
          appliedCount === totalCount
            ? `Applied ${appliedCount} dependency change${
                appliedCount === 1 ? "" : "s"
              }.`
            : `Applied ${appliedCount}/${totalCount} changes.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    } catch (err) {
      // Stop on first failure; keep remaining changes pending.
      if (err?.nextBaseline) {
        setBaselineGraphData(err.nextBaseline);
      }

      toast({
        title: "Failed to apply changes",
        description:
          err?.message || "An error occurred while applying changes.",
        status: "error",
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsApplyingChanges(false);
    }
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
              {focusedIssueId && (
                <FoundIssueTag
                  issueId={focusedIssueId}
                  onClear={() => setFocusedIssueId(null)}
                />
              )}
              <WrapItem spacing="3">
                {/* <Button colorScheme="blue" mr={3} onClick={onAPIKeyModalOpen}>
                  Settings
                </Button> */}
                {pendingOps.length > 0 && (
                  <Button
                    colorScheme="green"
                    mr={3}
                    onClick={onApplyChanges}
                    isDisabled={isApplyingChanges}
                    isLoading={isApplyingChanges}
                    loadingText="Applying"
                    title={`Apply ${pendingOps.length} pending dependency change${
                      pendingOps.length === 1 ? "" : "s"
                    }`}
                  >
                    Apply Changes
                    {pendingOps.length ? ` (${pendingOps.length})` : ""}
                  </Button>
                )}
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
                    <MenuDivider />
                    {hasGraphData && (
                      <>
                        <MenuItem onClick={onFindIssueOpen} command="Ctrl+F">
                          Find issue
                        </MenuItem>
                        <MenuDivider />
                      </>
                    )}
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
                    <MenuDivider />
                    {Object.keys(coordinateOverrides || {}).length > 0 && (
                      <MenuItem onClick={onResetLayoutOpen}>
                        Reset layout
                      </MenuItem>
                    )}
                    <MenuItem onClick={onFlushCacheOpen}>Flush cache</MenuItem>
                  </MenuList>
                </Menu>
              </WrapItem>
            </Wrap>
          </Container>
        </Box>
      </Box>

      <FindIssueModal isOpen={isFindIssueOpen} onClose={onFindIssueClose} />

      <AlertDialog
        isOpen={isResetLayoutOpen}
        leastDestructiveRef={resetLayoutCancelRef}
        onClose={onResetLayoutClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Reset layout</AlertDialogHeader>
            <AlertDialogBody>
              This will reset the epic layout to its default positions. Any
              manual positioning will be lost.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={resetLayoutCancelRef} onClick={onResetLayoutClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                onClick={() => {
                  saveCoordinateOverrides(null);
                  onResetLayoutClose();
                }}
              >
                Reset
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog
        isOpen={isFlushCacheOpen}
        leastDestructiveRef={flushCacheCancelRef}
        onClose={onFlushCacheClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Flush cache</AlertDialogHeader>
            <AlertDialogBody>
              This will clear all cached graph data. The next graph load will
              make fresh requests to the Zenhub API.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={flushCacheCancelRef} onClick={onFlushCacheClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                ml={3}
                onClick={() => {
                  clearGraphCache();
                  onFlushCacheClose();
                }}
              >
                Flush cache
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
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

function FoundIssueTag({ issueId, onClear }) {
  const currentGraphData = useAtomValue(currentGraphDataAtom);
  const issue = currentGraphData?.find(({ id }) => id === issueId);
  const label = issue ? `${issue.id} ${issue.title}` : issueId;

  return (
    <WrapItem alignItems="center">
      <Tag colorScheme="orange" borderRadius="full" maxW="260px" title={label}>
        <TagLabel>Found: {label}</TagLabel>
        <TagCloseButton title="Clear highlight (Esc)" onClick={onClear} />
      </Tag>
    </WrapItem>
  );
}

function FindIssueModal({ isOpen, onClose }) {
  const currentGraphData = useAtomValue(currentGraphDataAtom);
  const [focusedIssueId, setFocusedIssueId] = useAtom(focusedIssueIdAtom);
  const selectRef = useRef();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const options = useMemo(
    () =>
      (currentGraphData || []).map(({ id, title }) => ({
        value: id,
        label: `${id} ${title}`,
      })),
    [currentGraphData],
  );

  const chosenOption =
    options.find(({ value }) => value === focusedIssueId) || null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={selectRef}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Find issue</ModalHeader>
        <ModalBody pb={6}>
          <Select
            ref={selectRef}
            isClearable
            openMenuOnFocus
            onMenuOpen={() => setIsMenuOpen(true)}
            onMenuClose={() => setIsMenuOpen(false)}
            onKeyDown={(e) => {
              // Let Escape close only the dropdown while it's open, rather than
              // also bubbling up and closing the popup.
              if (e.key === "Escape" && isMenuOpen) {
                e.stopPropagation();
              }
            }}
            options={options}
            value={chosenOption}
            placeholder="Find issue..."
            onChange={(option) => {
              setFocusedIssueId(option ? option.value : null);
              if (option) {
                onClose();
              }
            }}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function parseIssueNumber(input) {
  const trimmed = input.trim().replace(/^#/, "");
  return /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null;
}

function SelectEpicControl({ epicOptions, chosenEpic, setChosenEpic }) {
  const saveEpic = useSetAtom(epicAtom);

  function selectEpic(epicNumber) {
    // Clear the coordinate overrides from the query string when changing epics,
    // so the coords for the new epic can be loaded from localStorage.
    // TODO, a big refactor is needed to handle params and state better.
    const url = new URL(window.location);
    url.searchParams.delete("coordinateOverrides");
    window.history.pushState({}, undefined, url);

    saveEpic(epicNumber);
  }

  return (
    <FormControl>
      <Box w="200px">
        <CreatableSelect
          options={epicOptions}
          value={chosenEpic}
          placeholder="Epic, or issue #..."
          isValidNewOption={(input) => {
            const issueNumber = parseIssueNumber(input);
            return (
              issueNumber !== null &&
              !epicOptions.some(({ value }) => value === issueNumber)
            );
          }}
          formatCreateLabel={(input) => `Use issue #${parseIssueNumber(input)}`}
          onCreateOption={(input) => {
            const issueNumber = parseIssueNumber(input);
            // Show the number until the issue title has been fetched.
            setChosenEpic({ label: `#${issueNumber}`, value: issueNumber });
            selectEpic(issueNumber);
          }}
          onChange={(chosenEpic) => {
            selectEpic(chosenEpic.value);
          }}
        />
      </Box>
    </FormControl>
  );
}
