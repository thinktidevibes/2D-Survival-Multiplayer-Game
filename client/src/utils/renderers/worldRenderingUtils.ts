import { gameConfig } from '../../config/gameConfig';

/**
 * Renders the tiled world background onto the canvas, optimized to draw only visible tiles.
 * @param ctx - The CanvasRenderingContext2D to draw on.
 * @param grassImageRef - Ref to the loaded grass texture image.
 * @param cameraOffsetX - The camera's X offset in pixels.
 * @param cameraOffsetY - The camera's Y offset in pixels.
 * @param canvasWidth - The width of the canvas.
 * @param canvasHeight - The height of the canvas.
 */
export function renderWorldBackground(
    ctx: CanvasRenderingContext2D,
    grassImageRef: React.RefObject<HTMLImageElement | null>,
    cameraOffsetX: number,
    cameraOffsetY: number,  
    canvasWidth: number,
    canvasHeight: number
): void {
    const grassImg = grassImageRef.current;
    const { tileSize } = gameConfig;

    if (!grassImg || !grassImg.complete || grassImg.naturalHeight === 0) {
        // Draw fallback color if image not loaded or invalid
        ctx.fillStyle = '#8FBC8F'; // Medium Aquamarine fallback
        // Only fill the visible area for the fallback
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        // console.warn("[renderWorldBackground] Grass image not ready, drawing fallback for visible area.");
        return;
    }

    // Calculate the visible world coordinates
    const viewMinX = -cameraOffsetX;
    const viewMinY = -cameraOffsetY;
    const viewMaxX = viewMinX + canvasWidth;
    const viewMaxY = viewMinY + canvasHeight;

    // Calculate the range of tile indices to draw
    const startTileX = Math.max(0, Math.floor(viewMinX / tileSize));
    const endTileX = Math.min(gameConfig.worldWidth, Math.ceil(viewMaxX / tileSize));
    const startTileY = Math.max(0, Math.floor(viewMinY / tileSize));
    const endTileY = Math.min(gameConfig.worldHeight, Math.ceil(viewMaxY / tileSize));

    const drawGridLines = false; // Keep grid lines off
    const overlap = 1; // Overlap tiles slightly to prevent gaps

    // console.log(`Drawing tiles X: ${startTileX}-${endTileX}, Y: ${startTileY}-${endTileY}`);

    // --- Draw ONLY visible tiles --- 
    for (let y = startTileY; y < endTileY; y++) {
        for (let x = startTileX; x < endTileX; x++) {
            ctx.drawImage(
                grassImg,
                x * tileSize,
                y * tileSize,
                tileSize + overlap,
                tileSize + overlap
            );
        }
    }
    // --- End visible tile drawing ---

    // Optional: Draw grid lines only for visible area
    if (drawGridLines) {
        ctx.strokeStyle = 'rgba(221, 221, 221, 0.5)';
        ctx.lineWidth = 1;
        for (let y = startTileY; y < endTileY; y++) {
            for (let x = startTileX; x < endTileX; x++) {
                ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
    }
} 