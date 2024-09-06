/**
 * External dependencies
 */
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
import { useParameter } from "./hooks/useParameter";
import { additionalColorDefaults, pipelineColorDefaults } from "./d3/constants";
import Panel from "./Panel";
import { toFixedDecimalPlaces } from "./d3/utils";
import { appSettingDefaults } from "./constants";
import { APIKeyAtom } from "./store/atoms";

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

function coordinateOverridesToLocalStorageValue(coordinateOverrides, epic) {
  function firstValue(obj) {
    return Object.values(obj)[0];
  }

  const isOldFormat =
    typeof firstValue(coordinateOverrides) === "object" &&
    typeof firstValue(firstValue(coordinateOverrides)) === "object";

  if (isOldFormat) {
    // Migrate legacy coordinateOverrides to new format.
    Object.entries(coordinateOverrides).forEach(
      ([epicNumber, epicOverrides]) => {
        localStorage.setItem(
          `coordinateOverrides-${epicNumber}`,
          JSON.stringify(
            Object.entries(epicOverrides).reduce(
              (overrides, [issueNumber, coordinates]) => {
                overrides[issueNumber] = {
                  x: toFixedDecimalPlaces(parseFloat(coordinates.x), 1),
                  y: toFixedDecimalPlaces(parseFloat(coordinates.y), 1),
                };

                return overrides;
              },
              {}
            )
          )
        );
      }
    );

    localStorage.removeItem("coordinateOverrides");

    return JSON.parse(
      localStorage.getItem(`coordinateOverrides-${epic}`) || "{}"
    );
  }

  return coordinateOverrides;
}

// TODO: Make this and the parameter hooks nicer.
function bootstrapParameters() {
  const url = new URL(window.location);
  [
    { key: "workspace" },
    { key: "sprint" },
    { key: "epic", parse: (v) => parseInt(v, 10) },
    {
      key: "appSettings",
      isObject: true,
      parse: (appSettings) => ({
        ...appSettingDefaults,
        ...appSettings,
      }),
    },
    { key: "pipelineColors", isObject: true },
    { key: "additionalColors", isObject: true },
    { key: "pipelineHidden", isObject: true },
    {
      key: "coordinateOverrides",
      isObject: true,
      toLocalStorage: (coordinateOverrides) => {
        // By now the epic should be set. If not, bail out.
        const epic = url.searchParams.get("epic");
        if (!epic) return null;

        return {
          localStorageKey: `coordinateOverrides-${epic}`,
          localStorageValue: coordinateOverridesToLocalStorageValue(
            coordinateOverrides,
            epic
          ),
        };
      },
      fromLocalStorage: () => {
        const epic = url.searchParams.get("epic");
        if (!epic) return null;

        return {
          localStorageKey: `coordinateOverrides-${epic}`,
        };
      },
    },
  ].forEach(
    ({ key, parse = (v) => v, isObject, toLocalStorage, fromLocalStorage }) => {
      if (url.searchParams.has(key)) {
        const value = isObject
          ? parse(JSON.parse(url.searchParams.get(key)))
          : parse(url.searchParams.get(key));

        const { localStorageKey, localStorageValue } =
          toLocalStorage?.(value) || {};

        // Local storage is always JSON.stringified.
        localStorage.setItem(
          localStorageKey || key,
          JSON.stringify(localStorageValue || value)
        );
      } else {
        const { localStorageKey } = fromLocalStorage?.() || {};

        const localValue = localStorage.getItem(localStorageKey || key);
        if (!localValue) return;

        let parsedValue;
        try {
          parsedValue = JSON.parse(localValue);
        } catch (err) {
          console.log("JSON parse error", err);
        }
        if (parsedValue) {
          url.searchParams.set(
            key,
            isObject ? JSON.stringify(localValue) : localValue
          );
          window.history.pushState({}, undefined, url);
        }
      }
    }
  );
}

bootstrapParameters();

function App({ authentication, panel }) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const APIKey = useAtomValue(APIKeyAtom);
  const [appSettings, saveAppSettings] = useParameter("appSettings", {});
  const [workspace, saveWorkspace] = useParameter("workspace", "");
  const [epic, saveEpic] = useParameter("epic", "");
  const [sprint, saveSprint] = useParameter("sprint", "");
  const [pipelineColors, savePipelineColors] = useParameter(
    "pipelineColors",
    pipelineColorDefaults
  );
  const [additionalColors, saveAdditionalColors] = useParameter(
    "additionalColors",
    additionalColorDefaults
  );
  // TODO: Merge pipelineColors and pipelineHidden if more pipeline settings are added.
  const [pipelineHidden, savePipelineHidden] = useParameter(
    "pipelineHidden",
    {}
  );
  const [coordinateOverrides, saveCoordinateOverrides] = useParameter(
    `coordinateOverrides-${epic}`,
    {},
    `coordinateOverrides`
  );

  // TODO: Migrate these to Jotai.
  const sharedStateProps = {
    appSettings,
    saveAppSettings,
    pipelineColors,
    savePipelineColors,
    additionalColors,
    saveAdditionalColors,
    pipelineHidden,
    savePipelineHidden,
    coordinateOverrides,
    saveCoordinateOverrides,
    workspace,
    saveWorkspace,
    epic,
    saveEpic,
    sprint,
    saveSprint,
  };

  return (
    <ChakraProvider theme={theme}>
      <Box>
        <Header
          appSettings={appSettings}
          pipelineColors={pipelineColors}
          savePipelineColors={savePipelineColors}
          additionalColors={additionalColors}
          saveAdditionalColors={saveAdditionalColors}
          pipelineHidden={pipelineHidden}
          savePipelineHidden={savePipelineHidden}
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
