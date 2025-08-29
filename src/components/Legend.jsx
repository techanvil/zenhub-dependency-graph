import { useAtom } from "jotai";

import {
  Box,
  Button,
  Flex,
  IconButton,
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

import { useState } from "react";
import Sketch from "@uiw/react-color-sketch";
import { additionalColorDefaults } from "../d3/constants";
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
          <IconButton
            w="20px"
            h="20px"
            size={20}
            bg={color}
            borderRadius="md"
            mr={2}
            onClick={onToggle}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
            </svg>
          </IconButton>
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

  const pipelineColorItems = Object.entries(pipelineColors);

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
    </Flex>
  );
}
