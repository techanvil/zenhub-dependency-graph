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

function getGraphElement({
  includeBackground,
}: {
  includeBackground: boolean;
}) {
  // const graphElement = document.getElementById("zdg-graph");
  const graphElement = document.querySelector("svg#zdg-graph");
  if (!graphElement) return { svgElement: null };

  const clonedGraphElement = graphElement.cloneNode(true) as SVGElement;

  clonedGraphElement.removeAttribute("id");
  clonedGraphElement.removeAttribute("style");

  const viewport = clonedGraphElement.querySelector(
    ".svg-pan-zoom_viewport",
  ) as SVGGElement;

  /*
    This is what the viewport element looks like:
      <g xmlns="http://www.w3.org/2000/svg"
        ...
        transform="matrix(1.2172270499876534,0,0,1.2172270499876534,370.04615186650653,112.14103406755098)"
        style="transform: matrix(1.21723, 0, 0, 1.21723, 370.046, 112.141);">
  */

  let scaleX = 1,
    scaleY = 1;

  function resetTransformPosition(transform: string) {
    // Remove 'matrix(' and ')' and split the remaining string
    const matrixValues = transform
      .replace("matrix(", "")
      .replace(")", "")
      .split(",")
      .map(Number);

    scaleX = matrixValues[0];
    scaleY = matrixValues[3];

    // Keep scale and skew values (first 4), but reset translation (last 2) to 0:
    return `matrix(${matrixValues[0]},${matrixValues[1]},${matrixValues[2]},${matrixValues[3]},0,0)`;
  }

  // Reset the viewport x, y position to 0, 0 while retaining the scale and skew.
  if (viewport) {
    const transform = viewport.getAttribute("transform");
    if (transform) {
      const newTransform = resetTransformPosition(transform);
      viewport.setAttribute("transform", newTransform);
    }

    const style = viewport.getAttribute("style");
    if (style) {
      const transform = style.match(/transform: ([^;]+)/)?.[1];
      if (transform) {
        const newTransform = resetTransformPosition(transform);
        viewport.setAttribute("style", style.replace(transform, newTransform));
      }
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

  // TODO: Provide an option to include a white background.

  clonedGraphElement.querySelector("#svg-pan-zoom-controls")?.remove();

  const originalViewport = graphElement.querySelector(
    ".svg-pan-zoom_viewport",
  ) as SVGGElement;
  const { width, height } = originalViewport.getBBox();

  if (includeBackground) {
    const backgroundRect = clonedGraphElement.querySelector(
      ".zdg-background",
    ) as SVGRectElement;
    // The graph dimensions may have been changed by drag/drop or pan/zoom, so update the background rect dimensions.
    backgroundRect.setAttribute("width", width.toString());
    backgroundRect.setAttribute("height", height.toString());
    backgroundRect.setAttribute("fill", "white");
  }

  return {
    svgElement: clonedGraphElement,
    width: width * scaleX,
    height: height * scaleY,
  };
}

export async function downloadSVG(
  epicName: string,
  { includeBackground }: { includeBackground: boolean },
) {
  const { svgElement } = getGraphElement({ includeBackground });
  if (!svgElement) return;

  // Serialize the SVG.
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  // Create a Blob from the SVG string.
  const blob = new Blob([svgString], { type: "image/svg+xml" });

  // Use the File System Access API to save the file.
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

export async function copyPNG({
  includeBackground,
}: {
  includeBackground: boolean;
}) {
  const { svgElement, width, height } = getGraphElement({ includeBackground });
  if (!svgElement) return;

  // Convert the SVG to a PNG
  const pngBlob = await svgToPNG(svgElement, width, height);

  // Copy to the clipboard.
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ [pngBlob.type]: pngBlob }),
    ]);
  } catch (error) {
    console.error("Clipboard write failed:", error);
  }
}

async function svgToPNG(
  svgElement: SVGElement,
  width: number,
  height: number,
): Promise<Blob> {
  // Create a canvas and get its context
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Create an image element and set its source to the SVG.
  const img = new Image();
  const svgBlob = new Blob(
    [new XMLSerializer().serializeToString(svgElement)],
    { type: "image/svg+xml" },
  );
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    img.onload = () => {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        resolve(blob!);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
