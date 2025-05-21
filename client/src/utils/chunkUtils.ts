import { gameConfig } from '../config/gameConfig';

// Type definition for viewport bounds
interface Viewport {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * Calculates the 1D chunk indices that overlap with the given viewport bounds.
 * Assumes a row-major order for chunk indexing (index = y * width + x).
 * IMPORTANT: This calculation MUST match the server's chunk index assignment logic.
 *
 * @param viewport The viewport boundaries { minX, minY, maxX, maxY }.
 * @returns An array of 1D chunk indices.
 */
export const getChunkIndicesForViewport = (viewport: Viewport | null): number[] => {
    if (!viewport) return [];

    const { chunkSizePx, worldWidthChunks, worldHeightChunks } = gameConfig;

    // Calculate the range of chunk coordinates (X and Y) covered by the viewport
    // Ensure chunk coordinates stay within the world bounds (0 to width/height - 1)
    const minChunkX = Math.max(0, Math.floor(viewport.minX / chunkSizePx));
    const maxChunkX = Math.min(worldWidthChunks - 1, Math.floor(viewport.maxX / chunkSizePx));
    const minChunkY = Math.max(0, Math.floor(viewport.minY / chunkSizePx));
    const maxChunkY = Math.min(worldHeightChunks - 1, Math.floor(viewport.maxY / chunkSizePx));

    const indices: number[] = [];

    // Iterate through the 2D chunk range and calculate the 1D index
    for (let y = minChunkY; y <= maxChunkY; y++) {
        for (let x = minChunkX; x <= maxChunkX; x++) {
            // Calculate 1D index using row-major order
            const index = y * worldWidthChunks + x;
            indices.push(index);
        }
    }
    
    // Log the calculation for debugging (optional)
    // console.log(`Viewport: ${JSON.stringify(viewport)}, Chunks (X: ${minChunkX}-${maxChunkX}, Y: ${minChunkY}-${maxChunkY}), Indices: ${indices.join(',')}`);

    return indices;
}; 