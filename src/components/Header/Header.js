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
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { AsyncSelect, Select } from "chakra-react-select";

/**
 * Internal dependencies
 */
import { getAllEpics, getWorkspaces } from "../../data/graph-data";
import { isEmpty } from "../../utils/common";

export default function Header({
  APIKey,
  onAPIKeyModalOpen = () => {},
  workspace,
  saveWorkspace,
  epic,
  saveEpic,
  epicIssue,
}) {
  const [chosenWorkspace, setChosenWorkspace] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState(false);
  const [allEpics, setAllEpics] = useState([]);

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

      const options = workspaces.map(
        ({ name, id, zenhubOrganizationName }) => ({
          label: `${name} (${zenhubOrganizationName})`,
          value: id,
          name,
        })
      );

      return options;
    },
    [APIKey]
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
          setChosenWorkspace(options[0]);
        }
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setWorkspaceOptions([]);
      });

    return () => controller.abort();
  }, [APIKey, loadOptions, workspace]);

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
      .then(setAllEpics)
      .catch((err) => {
        console.log("getGraphData error", err);
        setAllEpics([]);
      });

    return () => controller.abort();
  }, [APIKey, chosenWorkspace]);

  /*
  function entityToOption({ name, id }) {
    return { label: name, value: id };
  }
  */

  return (
    <>
      <Box as="section" h="80px">
        <Box
          as="nav"
          bg="bg-surface"
          boxShadow={useColorModeValue("sm", "sm-dark")}
        >
          <Container py={{ base: "4", lg: "5" }} maxW="100%">
            <HStack spacing="10" justify="space-between">
              <Flex justify="space-between" flex="1">
                <HStack>
                  <Heading as="h4" size="md">
                    Zenhub Dependency Graph
                  </Heading>
                </HStack>
                <HStack>
                  <FormControl>
                    <Box w="250px">
                      <AsyncSelect
                        cacheOptions
                        loadOptions={(workspaceName) =>
                          loadOptions(workspaceName)
                        }
                        defaultOptions={workspaceOptions}
                        value={chosenWorkspace}
                        onChange={(workspace) => {
                          setChosenWorkspace(workspace);
                          saveWorkspace(workspace.name);
                        }}
                      />
                    </Box>
                  </FormControl>
                  <FormControl>
                    <Box w="250px">
                      <Select
                        options={allEpics.map((anEpic) => ({
                          label: anEpic.title,
                          value: anEpic.number,
                        }))}
                        onChange={(chosenEpic) => saveEpic(chosenEpic.value)}
                      />
                    </Box>
                  </FormControl>
                </HStack>
                <HStack>
                  <Text>
                    <b>{epicIssue?.title}</b>
                  </Text>
                </HStack>
                <HStack spacing="3">
                  <Button colorScheme="blue" mr={3} onClick={onAPIKeyModalOpen}>
                    API Key
                  </Button>
                </HStack>
              </Flex>
            </HStack>
          </Container>
        </Box>
      </Box>
    </>
  );
}
