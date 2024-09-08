/**
 * External dependencies
 */
import React from "react";
import { useAtomValue } from "jotai";
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
import { APIKeyAtom } from "./store/atoms";
import { Session, SignInFunction, SignOutFunction } from "./auth-types";

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

interface AppProps {
  // These optional props are provided for the chrysalis/Gemini integration,
  // See https://github.com/techanvil/chrysalis
  authentication?: {
    // TODO: Provide abstractions around these types from @auth/core.
    session: Session | null;
    signIn: () => ReturnType<SignInFunction<"email">>;
    signInLabel: string;
    signOut: SignOutFunction;
  };
  panel?: {
    buttonTitle: string;
    PanelComponent: ({
      graphData,
    }: {
      graphData: any; // GraphData type to be defined.
    }) => React.ReactNode;
  };
}

function App({ authentication, panel }: AppProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const APIKey = useAtomValue(APIKeyAtom);

  return (
    <ChakraProvider theme={theme}>
      <Box>
        <Header
          onAPIKeyModalOpen={onOpen}
          authentication={authentication}
          panel={panel}
        />
        <Flex direction="row">
          <Box flex="1" id="graph-container">
            {APIKey ? (
              <SVG />
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
          <Panel panel={panel} />
        </Flex>
        <SettingsModal isOpen={isOpen} onClose={onClose} />
      </Box>
    </ChakraProvider>
  );
}

export default App;
