/**
 * External dependencies
 */
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  Heading,
  HStack,
  Input,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState } from "react";

/**
 * Internal dependencies
 */
import { useLocalStorage } from "../../hooks/useLocalStorage";

export default function Header({ onAPIKeyModalOpen = () => {} }) {
  const [savedWorkspace, saveWorkspace] = useLocalStorage(
    "zenhubWorkspace",
    ""
  );
  const [savedEpic, saveEpic] = useLocalStorage("zenhubEpicIssueNumber", "");
  // TODO: Probably don't need so much state...
  const [workspace, setWorkspace] = useState(savedWorkspace);
  const [epic, setEpic] = useState(savedEpic);

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
                    <Input
                      placeholder="Workspace Name"
                      value={workspace}
                      onChange={(e) => {
                        saveWorkspace(e.target.value);
                        setWorkspace(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormControl>
                    <Input
                      placeholder="Epic Issue Number"
                      value={epic || ""}
                      onChange={(e) => {
                        const epicIssueNumber =
                          e.target.value && parseInt(e.target.value, 10);
                        saveEpic(epicIssueNumber);
                        setEpic(epicIssueNumber);
                      }}
                    />
                  </FormControl>
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
