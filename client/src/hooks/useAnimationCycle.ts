import { useState, useEffect, useRef } from 'react';

// Custom Hook for Animation
export function useAnimationCycle(interval: number, numFrames: number): number {
  const [animationFrame, setAnimationFrame] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setAnimationFrame(frame => (frame + 1) % numFrames);
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, numFrames]);

  return animationFrame;
} 