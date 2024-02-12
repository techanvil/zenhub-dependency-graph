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
  Text,
  useDisclosure,
} from "@chakra-ui/react";

import { useState } from "react";
import Sketch from "@uiw/react-color-sketch";

function LegendItem({ label, color, colors, saveColors }) {
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
      <Text>{label}</Text>
    </Flex>
  );
}

export function Legend({
  pipelineColors,
  savePipelineColors,
  additionalColors,
  saveAdditionalColors,
}) {
  const pipelineColorItems = Object.entries(pipelineColors);
  const additionalColorItems = Object.entries(additionalColors);

  return (
    <Flex direction="column">
      {pipelineColorItems.map(([label, color], index) => (
        <LegendItem
          key={index}
          label={label}
          color={color}
          colors={pipelineColors}
          saveColors={savePipelineColors}
        />
      ))}
      <hr />
      {additionalColorItems.map(([label, color], index) => (
        <LegendItem
          key={index}
          label={label}
          color={color}
          colors={additionalColors}
          saveColors={saveAdditionalColors}
        />
      ))}
    </Flex>
  );
}
