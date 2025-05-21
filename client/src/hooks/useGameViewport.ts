import { useState, useEffect, useMemo } from 'react';
import { Player as SpacetimeDBPlayer } from '../generated'; // Import Player type

interface GameViewportResult {
  canvasSize: { width: number; height: number };
  cameraOffsetX: number;
  cameraOffsetY: number;
}

/**
 * Manages canvas size based on window dimensions and calculates camera offset.
 * @param localPlayer - The current local player data, or null/undefined if not available.
 */
export function useGameViewport(
    localPlayer: SpacetimeDBPlayer | null | undefined
): GameViewportResult {
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Effect to handle window resizing
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    // Call handler once initially to set size
    // handleResize(); // Removed, useState initial value handles this

    // Cleanup listener on component unmount
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty dependency array means this effect runs once on mount and cleanup on unmount

  // Calculate camera offset based on player position and canvas size
  const cameraOffsetX = useMemo(() => {
    return localPlayer ? (canvasSize.width / 2 - localPlayer.positionX) : 0;
  }, [localPlayer, canvasSize.width]);

  const cameraOffsetY = useMemo(() => {
    return localPlayer ? (canvasSize.height / 2 - localPlayer.positionY) : 0;
  }, [localPlayer, canvasSize.height]);

  return {
    canvasSize,
    cameraOffsetX,
    cameraOffsetY,
  };
} 