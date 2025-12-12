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

function getGraphCanvas(): HTMLCanvasElement | null {
  return document.querySelector("canvas#zdg-graph");
}

async function canvasToPngBlob(
  canvas: HTMLCanvasElement,
  { includeBackground }: { includeBackground: boolean },
): Promise<Blob> {
  // If background is requested, draw the WebGL canvas onto a 2D canvas with a
  // solid fill first (this also ensures we export exactly what the user sees).
  const source = canvas;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = source.width;
  exportCanvas.height = source.height;

  const ctx = exportCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context not available");
  }

  if (includeBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  ctx.drawImage(source, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create PNG blob"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function downloadPNG(
  epicName: string,
  { includeBackground }: { includeBackground: boolean },
) {
  const canvas = getGraphCanvas();
  if (!canvas) return;

  const blob = await canvasToPngBlob(canvas, { includeBackground });

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${epicName.replace(/[^a-zA-Z0-9]/g, "-")}-dependency-graph.png`,
        types: [
          {
            description: "PNG File",
            accept: { "image/png": [".png"] },
          },
        ],
      });

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
  const canvas = getGraphCanvas();
  if (!canvas) return;

  const pngBlob = await canvasToPngBlob(canvas, { includeBackground });

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ [pngBlob.type]: pngBlob }),
    ]);
  } catch (error) {
    console.error("Clipboard write failed:", error);
  }
}
