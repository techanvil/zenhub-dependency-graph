declare global {
  interface Window {
    showSaveFilePicker: (options?: {
      suggestedName?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }
}

function getGraphElement() {
  // const graphElement = document.getElementById("zdg-graph");
  const graphElement = document.querySelector("svg#zdg-graph");
  if (!graphElement) return null;

  const clonedGraphElement = graphElement.cloneNode(true) as SVGElement;

  const viewport = clonedGraphElement.querySelector(".svg-pan-zoom_viewport");

  /*
    This is what the viewport element looks like:
      <g xmlns="http://www.w3.org/2000/svg"
        ...
        transform="matrix(1.2172270499876534,0,0,1.2172270499876534,370.04615186650653,112.14103406755098)"
        style="transform: matrix(1.21723, 0, 0, 1.21723, 370.046, 112.141);">
  */

  // Reset the viewport x, y position to 0, 0 while retaining the scale and skew.
  if (viewport) {
    const transform = viewport.getAttribute("transform");
    if (transform) {
      // Remove 'matrix(' and ')' and split the remaining string
      const matrixValues = transform
        .replace("matrix(", "")
        .replace(")", "")
        .split(",")
        .map(Number);

      // Keep scale and skew values (first 4), but reset translation (last 2) to 0:
      const newTransform = `matrix(${matrixValues[0]},${matrixValues[1]},${matrixValues[2]},${matrixValues[3]},0,0)`;
      viewport.setAttribute("transform", newTransform);
      viewport.setAttribute("style", `transform: ${newTransform}`);
    }
  }

  // TODO: Make this an option:
  // Remove the viewport, appending its children to the cloned graph element
  // const viewport = clonedGraphElement.querySelector(".svg-pan-zoom_viewport");
  // if (viewport) {
  //   viewport.parentNode?.removeChild(viewport);
  //   Array.from(viewport.children).forEach((child) => {
  //     clonedGraphElement.appendChild(child);
  //   });
  // }

  clonedGraphElement.querySelector("#svg-pan-zoom-controls")?.remove();

  return clonedGraphElement;
}

export async function downloadSVG(epicName: string) {
  const svgElement = getGraphElement();
  if (!svgElement) return;

  // Serialize the SVG
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  // Create a Blob from the SVG string
  const blob = new Blob([svgString], { type: "image/svg+xml" });

  // Use the File System Access API to save the file
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${epicName.replace(/[^a-zA-Z0-9]/g, "-")}-dependency-graph.svg`,
        types: [
          {
            description: "SVG File",
            accept: { "image/svg+xml": [".svg"] },
          },
        ],
      });

      // Write the file
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      console.error("Save file canceled or failed:", error);
    }
  } else {
    alert("Your browser does not support the File System Access API.");
  }
}
