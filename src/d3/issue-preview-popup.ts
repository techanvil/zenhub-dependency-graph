import * as d3 from "d3";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
// import {read} from 'to-vfile'
import { unified } from "unified";

let currentPopup: d3.Selection<
  HTMLDivElement,
  unknown,
  HTMLElement,
  any
> | null = null;

/**
 * Creates and displays a preview popup with HTML content
 * @param x - X coordinate relative to the SVG element
 * @param y - Y coordinate relative to the SVG element
 * @param htmlContent - HTML content to display in the popup
 * @param svgElement - The SVG element to position relative to
 * @returns The created popup d3 selection
 */
export function createPopup(
  x: number,
  y: number,
  htmlContent: string,
  svgElement: SVGSVGElement,
): d3.Selection<HTMLDivElement, unknown, HTMLElement, any> {
  // Remove any existing popup
  removePopup();

  // Create popup element
  const popup = d3
    .select("body")
    .append("div")
    .attr("class", "zdg-issue-preview-popup")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "8px")
    .style("padding", "12px")
    .style("box-shadow", "0 4px 12px rgba(0, 0, 0, 0.15)")
    .style("max-width", "400px")
    .style("max-height", "300px")
    .style("overflow", "auto")
    .style("z-index", "1000")
    .style("font-size", "14px")
    .style("line-height", "1.4")
    .style("opacity", "0")
    .html(htmlContent);

  // Position popup near the node, but adjust to keep it in viewport
  const rect = svgElement.getBoundingClientRect();
  const popupNode = popup.node();
  const popupRect = popupNode?.getBoundingClientRect();

  if (!popupRect) {
    return popup;
  }

  let left = rect.left + x + 20; // Offset to avoid overlapping the node
  let top = rect.top + y - popupRect.height / 2;

  // Adjust if popup goes off-screen
  if (left + popupRect.width > window.innerWidth) {
    left = rect.left + x - popupRect.width - 20;
  }
  if (top < 0) {
    top = 10;
  }
  if (top + popupRect.height > window.innerHeight) {
    top = window.innerHeight - popupRect.height - 10;
  }

  popup
    .style("left", `${left}px`)
    .style("top", `${top}px`)
    .transition()
    .duration(200)
    .style("opacity", "1");

  currentPopup = popup;
  return popup;
}

/**
 * Removes the currently displayed popup with a fade-out animation
 */
export function removePopup(): void {
  if (currentPopup) {
    currentPopup.transition().duration(150).style("opacity", "0").remove();
    currentPopup = null;
  }
}

/**
 * Checks if a popup is currently being displayed
 * @returns True if a popup is currently visible
 */
export function hasActivePopup(): boolean {
  return currentPopup !== null;
}

export async function createPreviewPopup(
  d: any,
  svgElement: SVGSVGElement,
): Promise<d3.Selection<HTMLDivElement, unknown, HTMLElement, any>> {
  const { x, y } = d;
  // const { body: markdownBody, htmlUrl } = d.data;
  const { body: markdownBody } = d.data;

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdownBody);

  const body = String(file);

  console.log(body);

  return createPopup(x, y, body, svgElement);
}
