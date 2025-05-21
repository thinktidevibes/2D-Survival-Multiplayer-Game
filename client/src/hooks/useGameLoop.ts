import { useEffect, useRef, useCallback } from 'react';

/**
 * Manages a requestAnimationFrame loop.
 * @param callback - The function to call on each animation frame.
 */
export function useGameLoop(callback: () => void): void {
  const requestIdRef = useRef<number>(0);
  const savedCallback = useRef(callback); // Ref to store the latest callback

  // Update the saved callback function if it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Effect to manage the animation frame loop
  useEffect(() => {
    const loop = () => {
      // Call the latest saved callback
      savedCallback.current();
      // Request the next frame and store the ID
      requestIdRef.current = requestAnimationFrame(loop);
    };

    // Start the loop
    // console.log("[useGameLoop] Starting animation frame loop.");
    requestIdRef.current = requestAnimationFrame(loop);

    // Cleanup function to cancel the animation frame on unmount
    return () => {
      // console.log("[useGameLoop] Cancelling animation frame loop with ID:", requestIdRef.current);
      cancelAnimationFrame(requestIdRef.current);
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount

  // This hook doesn't need to return anything
} 