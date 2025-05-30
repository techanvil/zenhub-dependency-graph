import {
  getContainerAndViewportRects,
  getSvgRatio,
} from "../d3/coordinate-utils";

declare global {
  interface Window {
    svgPanZoom?: any;
  }
}

interface IssueNodeData {
  data: {
    id: string;
    title: string;
    body?: string;
    htmlUrl: string;
    assignees: string[];
    estimate?: string;
    pipelineName: string;
    parentIds: string[];
    sprints?: string[];
    isChosenSprint?: boolean;
    isNonEpicIssue?: boolean;
  };
  x: number;
  y: number;
}

interface MousePosition {
  x: number;
  y: number;
}

/**
 * Converts mouse coordinates to SVG coordinates and returns the issue node at that position if it exists
 * @param mousePosition - Mouse coordinates in document space
 * @returns The issue node data at the mouse position, or null if no issue node is found
 */
export function getIssueNodeAtMousePosition(
  mousePosition: MousePosition,
): IssueNodeData | null {
  try {
    // Get the SVG element
    const svgElement = document.querySelector("#zdg-graph") as SVGSVGElement;
    if (!svgElement) {
      console.warn("SVG element not found");
      return null;
    }

    // Try to find the element at the mouse position
    const elementAtPosition = document.elementFromPoint(
      mousePosition.x,
      mousePosition.y,
    );

    if (!elementAtPosition) {
      return null;
    }

    // Look for an issue node element by traversing up the DOM
    let issueElement: Element | null = elementAtPosition;
    while (issueElement && !issueElement.classList.contains("zdg-issue")) {
      issueElement = issueElement.parentElement;
    }

    if (!issueElement) {
      return null;
    }

    // Extract the D3 data from the DOM element
    const d3Data = (issueElement as any).__data__;
    if (!d3Data || !d3Data.data) {
      console.warn("No D3 data found on issue element");
      return null;
    }

    return d3Data as IssueNodeData;
  } catch (error) {
    console.error("Error finding issue node at mouse position:", error);
    return null;
  }
}

/**
 * Converts document coordinates to SVG coordinates
 * @param mousePosition - Mouse coordinates in document space
 * @returns SVG coordinates, or null if conversion fails
 */
export function convertDocumentToSvgCoordinates(
  mousePosition: MousePosition,
): MousePosition | null {
  try {
    const svgElement = document.querySelector("#zdg-graph") as SVGSVGElement;
    if (!svgElement) {
      return null;
    }

    // Get the pan/zoom instance
    const panZoomInstance = window.svgPanZoom
      ? window.svgPanZoom("#zdg-graph")
      : null;

    if (!panZoomInstance) {
      // Fallback: use basic SVG coordinate conversion
      const svgRect = svgElement.getBoundingClientRect();
      return {
        x: mousePosition.x - svgRect.left,
        y: mousePosition.y - svgRect.top,
      };
    }

    // Get pan and zoom state
    const pan = panZoomInstance.getPan();
    const zoom = panZoomInstance.getZoom();

    // Get container and viewport rectangles
    const { containerRect, panZoomViewportRect } =
      getContainerAndViewportRects();

    if (!containerRect || !panZoomViewportRect) {
      // Fallback to basic conversion
      const svgRect = svgElement.getBoundingClientRect();
      return {
        x: mousePosition.x - svgRect.left,
        y: mousePosition.y - svgRect.top,
      };
    }

    // Get the DAG dimensions from the SVG viewBox
    const viewBox = svgElement.getAttribute("viewBox");
    if (!viewBox) {
      console.warn("No viewBox found on SVG element");
      return null;
    }

    const [, , dagWidth, dagHeight] = viewBox.split(" ").map(Number);

    // Calculate SVG ratio
    const svgRatio = getSvgRatio(
      containerRect,
      panZoomViewportRect,
      dagWidth,
      dagHeight,
    );

    // Convert document coordinates to SVG coordinates
    const containerRelativeX = mousePosition.x - containerRect.left;
    const containerRelativeY = mousePosition.y - containerRect.top;

    const svgX = (containerRelativeX - pan.x) / (svgRatio * zoom);
    const svgY = (containerRelativeY - pan.y) / (svgRatio * zoom);

    return { x: svgX, y: svgY };
  } catch (error) {
    console.error("Error converting document to SVG coordinates:", error);
    return null;
  }
}
