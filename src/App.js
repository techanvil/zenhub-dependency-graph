/**
 * External dependencies
 */
import { useAtom, useAtomValue } from "jotai";
import {
  Box,
  ChakraProvider,
  extendTheme,
  Flex,
  Link,
  useDisclosure,
} from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import Header from "./components/Header/Header";
import SettingsModal from "./components/SettingsModal/SettingsModal";
import SVG from "./components/SVG/SVG";
import Panel from "./Panel";
import { APIKeyAtom, coordinateOverridesAtom } from "./store/atoms";

// Responsive popover styling. See https://github.com/chakra-ui/chakra-ui/issues/2609
const theme = extendTheme({
  components: {
    Popover: {
      variants: {
        responsive: {
          content: { width: "unset" },
          popper: {
            maxWidth: "unset",
            width: "unset",
          },
        },
      },
    },
  },
});

function App({ authentication, panel }) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const APIKey = useAtomValue(APIKeyAtom);

  // TODO: Migrate these to Jotai.
  // TODO: Remove sharedStateProps.
  const sharedStateProps = {};

  return (
    <ChakraProvider theme={theme}>
      <Box>
        <Header
          onAPIKeyModalOpen={onOpen}
          authentication={authentication}
          panel={panel}
          {...sharedStateProps}
        />
        <Flex direction="row">
          <Box flex="1" id="graph-container">
            {APIKey ? (
              <SVG {...sharedStateProps} />
            ) : (
              <Box p={4}>
                <p>
                  Please add your <strong>Zenhub API key</strong> in{" "}
                  {authentication ? (
                    <strong>User &gt; Settings</strong>
                  ) : (
                    <strong>Settings</strong>
                  )}
                  .
                </p>
                <p>
                  To generate your Personal API Key, go to the{" "}
                  <Link
                    href="https://app.zenhub.com/settings/tokens"
                    isExternal
                    color="teal.500"
                  >
                    API section of your Zenhub Dashboard
                  </Link>
                  .
                </p>
              </Box>
            )}
          </Box>
          <Panel
            {...sharedStateProps}
            authentication={authentication}
            panel={panel}
          />
        </Flex>
        <SettingsModal
          isOpen={isOpen}
          onClose={onClose}
          {...sharedStateProps}
        />
      </Box>
    </ChakraProvider>
  );
}

export default App;
