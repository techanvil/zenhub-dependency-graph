import { useAtom } from "jotai";

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Text,
  useDisclosure,
} from "@chakra-ui/react";

import { useRef, useState } from "react";
import Sketch from "@uiw/react-color-sketch";
import { additionalColorDefaults, pipelineColorDefaults } from "../d3/constants";
import { deepEquals } from "../utils/common";
import {
  additionalColorsAtom,
  pipelineColorsAtom,
  pipelineHiddenAtom,
} from "../store/atoms";

function LegendItem({
  label,
  color,
  colors,
  isSolo,
  saveColors,
  isHidden,
  saveIsHidden,
}) {
  const { isOpen, onToggle, onClose } = useDisclosure();

  const [hex, setHex] = useState(color);

  return (
    <Flex align="center" my={2}>
      <Popover placement="bottom-end" isOpen={isOpen} onClose={onClose} isLazy>
        <PopoverTrigger>
          <Box
            w="20px"
            h="20px"
            bg={color}
            borderRadius="md"
            cursor="pointer"
            mr={2}
            _hover={{
              opacity: 0.7,
            }}
            onClick={onToggle}
          ></Box>
        </PopoverTrigger>
        <PopoverContent>
          <PopoverArrow />
          <PopoverCloseButton />
          {/* <PopoverHeader>Foo</PopoverHeader> */}
          <PopoverBody>
            <div>
              <Sketch
                style={{ marginLeft: 20 }}
                color={hex}
                disableAlpha
                onChange={(color) => {
                  setHex(color.hex);
                }}
              />
              <Box pt={2}>
                <Button
                  colorScheme="blue"
                  mr={3}
                  onClick={() => {
                    saveColors({
                      ...colors,
                      [label]: hex,
                    });
                    onClose();
                  }}
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </Box>
            </div>
          </PopoverBody>
        </PopoverContent>
      </Popover>
      <Text pr={3} mr="auto">
        {label}
      </Text>
      {isHidden !== undefined && (
        <Switch
          title={
            isSolo
              ? "Ctrl+click to show all pipelines"
              : "Ctrl+click to solo this pipeline"
          }
          // The switch shows the visible state, so we need to invert isHidden.
          isChecked={!isHidden}
          onChange={(e) => {
            const isCtrlPressed = !!e.nativeEvent.ctrlKey;
            saveIsHidden(isHidden, isCtrlPressed);
          }}
        />
      )}
    </Flex>
  );
}

export function Legend() {
  const [pipelineColors, savePipelineColors] = useAtom(pipelineColorsAtom);
  const [additionalColors, saveAdditionalColors] =
    useAtom(additionalColorsAtom);
  const [pipelineHidden, savePipelineHidden] = useAtom(pipelineHiddenAtom);

  const {
    isOpen: isResetOpen,
    onOpen: onResetOpen,
    onClose: onResetClose,
  } = useDisclosure();
  const resetCancelRef = useRef();

  const pipelineColorItems = Object.entries(pipelineColors);

  const colorsAreCustomised = !(
    deepEquals(pipelineColors, pipelineColorDefaults) &&
    deepEquals(additionalColors, additionalColorDefaults)
  );

  return (
    <Flex direction="column">
      {pipelineColorItems.map(([label, color], index) => {
        const isSolo =
          !pipelineHidden[label] &&
          Object.keys(pipelineHidden).length ===
            Object.keys(pipelineColors).length - 1;

        return (
          <LegendItem
            key={index}
            label={label}
            color={color}
            colors={pipelineColors}
            isSolo={isSolo}
            saveColors={savePipelineColors}
            isHidden={!!pipelineHidden[label]}
            saveIsHidden={(isHidden, isCtrlPressed) => {
              // TODO: pipelineHidden could in fact be an array rather than an object.
              let newHidden = { ...pipelineHidden };

              if (isCtrlPressed) {
                if (isSolo) {
                  newHidden = {};
                } else {
                  Object.keys(pipelineColors).forEach((pipelineName) => {
                    if (pipelineName === label) {
                      delete newHidden[pipelineName];
                    } else {
                      newHidden[pipelineName] = true;
                    }
                  });
                }
              } else {
                if (isHidden) {
                  delete newHidden[label];
                } else {
                  newHidden[label] = true;
                }
              }

              console.log("newHidden", newHidden);

              savePipelineHidden(newHidden);
            }}
          />
        );
      })}
      <hr />
      {
        // Iterate over the defaults to handle name changes.
        Object.keys(additionalColorDefaults).map((label, index) => {
          const color =
            additionalColors[label] || additionalColorDefaults[label];
          return (
            <LegendItem
              key={index}
              label={label}
              color={color}
              colors={additionalColors}
              saveColors={saveAdditionalColors}
            />
          );
        })
      }
      {colorsAreCustomised && (
        <>
          <hr />
          <Button mt={2} size="sm" colorScheme="blue" onClick={onResetOpen}>
            Reset colours
          </Button>
        </>
      )}

      <AlertDialog
        isOpen={isResetOpen}
        leastDestructiveRef={resetCancelRef}
        onClose={onResetClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Reset colours</AlertDialogHeader>
            <AlertDialogBody>
              This will restore all pipeline and issue colours to their
              defaults. This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={resetCancelRef} onClick={onResetClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                onClick={() => {
                  savePipelineColors(pipelineColorDefaults);
                  saveAdditionalColors(additionalColorDefaults);
                  onResetClose();
                }}
              >
                Reset
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Flex>
  );
}
