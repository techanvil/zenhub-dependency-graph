import {
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

import { useState } from "react";
import Sketch from "@uiw/react-color-sketch";
import { additionalColorDefaults } from "../d3/constants";

function LegendItem({
  label,
  color,
  colors,
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
            mr={2}
            onClick={onToggle}
          />
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
      <Text mr="auto">{label}</Text>
      <Switch
        // The switch shows the visible state, so we need to invert isHidden.
        isChecked={!isHidden}
        onChange={() => {
          saveIsHidden(isHidden);
        }}
      />
    </Flex>
  );
}

export function Legend({
  pipelineColors,
  savePipelineColors,
  additionalColors,
  saveAdditionalColors,
  pipelineHidden,
  savePipelineHidden,
}) {
  const pipelineColorItems = Object.entries(pipelineColors);

  return (
    <Flex direction="column">
      {pipelineColorItems.map(([label, color], index) => (
        <LegendItem
          key={index}
          label={label}
          color={color}
          colors={pipelineColors}
          saveColors={savePipelineColors}
          isHidden={pipelineHidden[label]}
          saveIsHidden={(isHidden) => {
            // TODO: pipelineHidden could in fact be an array rather than an object.
            const newHidden = { ...pipelineHidden };
            if (isHidden) {
              delete newHidden[label];
            } else {
              newHidden[label] = true;
            }
            savePipelineHidden(newHidden);
          }}
        />
      ))}
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
