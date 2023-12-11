import { Box, Flex, Text } from "@chakra-ui/react";
import { pipelineColors } from "../d3/constants";

export function Legend() {
  const legendItems = Object.entries(pipelineColors);

  return (
    <Flex direction="column">
      {legendItems.map(([label, color], index) => (
        <Flex key={index} align="center" my={2}>
          <Box w="20px" h="20px" bg={color} borderRadius="md" mr={2} />
          <Text>{label}</Text>
        </Flex>
      ))}
    </Flex>
  );
}
