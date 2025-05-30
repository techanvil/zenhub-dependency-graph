import React, { useEffect, useCallback } from "react";
import { Box, Text, Link, VStack, HStack, Badge } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { issuePreviewPopupAtom } from "../../store/atoms";
import { store } from "../../store/atoms";
import { getIssueNodeAtMousePosition } from "../../utils/mouse-position";
import { calculatePopupPosition } from "../../utils/popup-position";

function IssuePreviewPopup() {
  const [htmlContent, setHtmlContent] = React.useState<string>("");

  // Get all popup state from the atom
  const popupState = useAtomValue(issuePreviewPopupAtom);
  const {
    issueData,
    isOpen,
    position,
    isMeasuring,
    originalX,
    originalY,
    panZoomInstance,
    dagWidth,
    dagHeight,
  } = popupState;

  // Handler for when popup dimensions are measured
  const handlePopupMeasured = useCallback(
    (dimensions: { width: number; height: number }) => {
      if (
        !issueData ||
        !isMeasuring ||
        originalX === undefined ||
        originalY === undefined
      ) {
        return;
      }

      // Get the SVG element
      const svgElement = document.querySelector("#zdg-graph") as SVGSVGElement;
      if (!svgElement) {
        console.warn("SVG element not found for popup positioning");
        return;
      }

      // Calculate the correct position with actual dimensions
      const { x, y } = calculatePopupPosition(originalX, originalY, {
        svgElement,
        panZoomInstance,
        dagWidth,
        dagHeight,
        popupWidth: dimensions.width,
        popupHeight: dimensions.height,
      });

      // Update the atom with the correct position and show the popup
      store.set(issuePreviewPopupAtom, {
        isOpen: true,
        isMeasuring: false,
        issueData,
        position: { x, y },
        originalX,
        originalY,
        panZoomInstance,
        dagWidth: dagWidth || 0,
        dagHeight: dagHeight || 0,
      });
    },
    [
      issueData,
      isMeasuring,
      originalX,
      originalY,
      panZoomInstance,
      dagWidth,
      dagHeight,
    ],
  );

  // Callback to measure popup dimensions when in measuring mode
  const measuredRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && isMeasuring && handlePopupMeasured) {
        // Force a reflow to ensure accurate measurements
        requestAnimationFrame(() => {
          const rect = node.getBoundingClientRect();
          console.log("rect", rect);
          handlePopupMeasured({
            width: rect.width,
            height: rect.height,
          });
        });
      }
    },
    [isMeasuring, handlePopupMeasured],
  );

  useEffect(() => {
    // TODO: Consider using `react-markdown` instead of `unified`.
    const processMarkdown = async () => {
      if (!issueData?.body) {
        setHtmlContent("");
        return;
      }

      try {
        const file = await unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(remarkRehype)
          .use(rehypeStringify)
          .process(issueData.body);

        setHtmlContent(String(file));
      } catch (error) {
        console.error("Error processing markdown:", error);
        setHtmlContent(issueData.body);
      }
    };

    processMarkdown();
  }, [issueData]);

  function onClose(e: React.MouseEvent<HTMLDivElement>) {
    // Don't allow closing when measuring
    if (isMeasuring) {
      return;
    }

    const issueNode = getIssueNodeAtMousePosition({
      x: e.clientX,
      y: e.clientY,
    });

    if (issueNode?.data?.id === issueData?.id) {
      return;
    }

    // TODO:
    // - Consider using `useSetAtom` instead of `store.set`.
    // - Create a `hideIssuePreviewPopupAtom` atom or function as we're now hiding in multiple places.
    store.set(issuePreviewPopupAtom, {
      isOpen: false,
      issueData: null,
      position: { x: 0, y: 0 },
      isMeasuring: false,
      originalX: undefined,
      originalY: undefined,
      panZoomInstance: null,
      dagWidth: 0,
      dagHeight: 0,
    });
  }

  // Don't render if no issue data and not measuring
  if (!issueData || (!isOpen && !isMeasuring)) {
    return null;
  }

  return (
    <Box
      ref={measuredRef}
      position="fixed"
      left={`${position.x}px`}
      top={`${position.y}px`}
      bg="white"
      border="1px solid"
      borderColor="gray.300"
      borderRadius="md"
      p={3}
      maxW="800px" // TODO: Create constants for the popup width and height.
      maxH="600px"
      overflow="auto"
      boxShadow="lg"
      zIndex={1000}
      fontSize="sm"
      lineHeight="1.4"
      className="zdg-issue-preview-popup"
      onMouseLeave={onClose}
      opacity={isMeasuring ? 0 : 1}
      visibility={isMeasuring ? "hidden" : "visible"}
      pointerEvents={isMeasuring ? "none" : "auto"}
    >
      <VStack align="stretch" spacing={2}>
        <HStack justify="space-between" align="flex-start">
          <Text fontWeight="bold" fontSize="md" noOfLines={2}>
            {issueData.title}
          </Text>
          <Badge colorScheme="blue" variant="subtle">
            #{issueData.id}
          </Badge>
        </HStack>

        {issueData.assignees.length > 0 && (
          <Text fontSize="xs" color="gray.600">
            Assignees: {issueData.assignees.join(", ")}
          </Text>
        )}

        {issueData.estimate && (
          <Text fontSize="xs" color="gray.600">
            Estimate: {issueData.estimate}
          </Text>
        )}

        <Badge colorScheme="gray" variant="outline" alignSelf="flex-start">
          {issueData.pipelineName}
        </Badge>

        {htmlContent && (
          <Box
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            sx={{
              "& p": { margin: "0.5rem 0" },
              "& h1, & h2, & h3, & h4, & h5, & h6": {
                fontWeight: "bold",
                margin: "0.5rem 0",
              },
              "& ul, & ol": { paddingLeft: "1rem" },
              "& code": {
                bg: "gray.100",
                px: 1,
                py: 0.5,
                borderRadius: "sm",
                fontSize: "xs",
              },
              "& pre": {
                bg: "gray.100",
                p: 2,
                borderRadius: "sm",
                overflow: "auto",
                fontSize: "xs",
              },
            }}
          />
        )}

        <Link
          href={issueData.htmlUrl}
          isExternal
          color="blue.500"
          fontSize="xs"
          mt={2}
        >
          View on GitHub →
        </Link>
      </VStack>
    </Box>
  );
}

export default IssuePreviewPopup;
