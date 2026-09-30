/**
 * External dependencies
 */
import { useAtomValue } from "jotai";
import { Box, useColorModeValue } from "@chakra-ui/react";

/**
 * Internal dependencies
 */
import { selectedIssueCountAtom } from "../../store/atoms";

export default function SelectionCountPill() {
  const selectedIssueCount = useAtomValue(selectedIssueCountAtom);

  const bg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.300", "gray.600");

  if (selectedIssueCount === 0) {
    return null;
  }

  return (
    <Box
      position="absolute"
      bottom="16px"
      left="50%"
      transform="translateX(-50%)"
      px="3"
      py="1"
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="full"
      boxShadow="md"
      fontSize="small"
      // Don't block lassooing or panning underneath the pill.
      pointerEvents="none"
      role="status"
    >
      <b>{selectedIssueCount}</b>{" "}
      {selectedIssueCount === 1 ? "issue" : "issues"} selected
    </Box>
  );
}
