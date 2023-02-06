/**
 * External dependencies
 */
import { useEffect, useState } from "react";
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
import { Select } from "chakra-react-select";

/**
 * Internal dependencies 
 */
import { getAllOrganizations, getAllEpics } from "../../data/graph-data";
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
  const [allOrganizations, setAllOrganizations] = useState([]);
  const [chosenOrganization, setChosenOrganization] = useState(false);
  const [chosenWorkspace, setChosenWorkspace] = useState(false);
  const [allEpics, setAllEpics] = useState([]);

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
    ).then( ( organizations ) => {
      setAllOrganizations( organizations );
    } ).catch((err) => {
      console.log("getGraphData error", err);
      setAllOrganizations([]);
    });

    return () => controller.abort();
  }, [workspace, APIKey]);

  useEffect(() => {
    if (isEmpty(APIKey) || isEmpty(chosenWorkspace)) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    getAllEpics(
      chosenWorkspace,
      "https://api.zenhub.com/public/graphql/",
      APIKey,
      signal
    )
      .then(( epics ) => {
        setAllEpics( epics );
      })
      .catch((err) => {
        console.log("getGraphData error", err);
        setAllEpics([]);
      });

    return () => controller.abort();
  }, [APIKey, chosenWorkspace]);

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
                    <Select
                      options={ allOrganizations.map( ( organization ) => ( { label: organization.name, value: organization.id } ) ) }
                      onChange={ ( organization ) => setChosenOrganization(organization.value) }
                    />
                  </FormControl>
                  <FormControl>
                    <Select
                      options={ allOrganizations.find( ( organization ) => chosenOrganization === organization.id )?.workspaces.map( ( workspace ) => ( { label: workspace.name, value: workspace.id } ) ) }
                      onChange={ ( workspace ) => {setChosenWorkspace(workspace.value); saveWorkspace(workspace.label)} }
                    />
                  </FormControl>
                  <FormControl>
                    <Select
                      options={ allEpics.map( ( anEpic ) => ( { label: anEpic.title, value: anEpic.number } ) ) }
                      onChange={ ( chosenEpic ) => saveEpic(chosenEpic.value) }
                    />
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
