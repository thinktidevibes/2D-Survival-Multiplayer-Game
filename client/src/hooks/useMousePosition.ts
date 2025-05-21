import { useState, useEffect, useRef, RefObject } from 'react';

interface MousePosition {
  x: number | null;
  y: number | null;
}

interface UseMousePositionProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraOffsetX: number;
  cameraOffsetY: number;
  canvasSize: { width: number; height: number }; // Needed for scaling calculation
}

interface UseMousePositionResult {
  screenMousePos: MousePosition;
  worldMousePos: MousePosition;
  canvasMousePos: MousePosition;
}

/**
 * Tracks mouse position relative to the canvas and the game world.
 */
export function useMousePosition({
  canvasRef,
  cameraOffsetX,
  cameraOffsetY,
  canvasSize,
}: UseMousePositionProps): UseMousePositionResult {
  // Use state for positions so consumers can react to changes if needed
  const [screenMousePos, setScreenMousePos] = useState<MousePosition>({ x: null, y: null });
  const [worldMousePos, setWorldMousePos] = useState<MousePosition>({ x: null, y: null });
  const [canvasMousePos, setCanvasMousePos] = useState<MousePosition>({ x: null, y: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Calculate scale based on current canvas size and rect size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      // Calculate screen coordinates
      const currentScreenX = (event.clientX - rect.left) * scaleX;
      const currentScreenY = (event.clientY - rect.top) * scaleY;
      setScreenMousePos({ x: currentScreenX, y: currentScreenY });

      // Calculate world coordinates using camera offset
      const currentWorldX = currentScreenX - cameraOffsetX;
      const currentWorldY = currentScreenY - cameraOffsetY;
      setWorldMousePos({ x: currentWorldX, y: currentWorldY });

      // Calculate canvas coordinates
      const canvasX = currentScreenX - rect.left;
      const canvasY = currentScreenY - rect.top;
      setCanvasMousePos({ x: canvasX, y: canvasY });
    };

    const handleMouseLeave = () => {
      setScreenMousePos({ x: null, y: null });
      setWorldMousePos({ x: null, y: null });
      setCanvasMousePos({ x: null, y: null });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Cleanup listeners
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  // Re-run effect if canvasRef, offsets, or canvasSize changes
  }, [canvasRef, cameraOffsetX, cameraOffsetY, canvasSize]);

  return {
    screenMousePos,
    worldMousePos,
    canvasMousePos,
  };
} 