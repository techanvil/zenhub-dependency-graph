import React from "react";
import { Box, Text, Link, VStack, HStack, Badge } from "@chakra-ui/react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

interface IssueData {
  id: string;
  title: string;
  body: string;
  htmlUrl: string;
  assignees: string[];
  estimate?: string;
  pipelineName: string;
  number: number;
}

interface IssuePreviewPopupProps {
  issueData: IssueData;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

const IssuePreviewPopup: React.FC<IssuePreviewPopupProps> = ({
  issueData,
  isOpen,
  position,
}) => {
  const [htmlContent, setHtmlContent] = React.useState<string>("");

  React.useEffect(() => {
    const processMarkdown = async () => {
      if (!issueData.body) {
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
  }, [issueData.body]);

  if (!isOpen) {
    return null;
  }

  return (
    <Box
      position="fixed"
      left={`${position.x}px`}
      top={`${position.y}px`}
      bg="white"
      border="1px solid"
      borderColor="gray.300"
      borderRadius="md"
      p={3}
      maxW="400px"
      maxH="300px"
      overflow="auto"
      boxShadow="lg"
      zIndex={1000}
      fontSize="sm"
      lineHeight="1.4"
      className="zdg-issue-preview-popup"
    >
      <VStack align="stretch" spacing={2}>
        <HStack justify="space-between" align="flex-start">
          <Text fontWeight="bold" fontSize="md" noOfLines={2}>
            {issueData.title}
          </Text>
          <Badge colorScheme="blue" variant="subtle">
            #{issueData.number}
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
};

export default IssuePreviewPopup;
