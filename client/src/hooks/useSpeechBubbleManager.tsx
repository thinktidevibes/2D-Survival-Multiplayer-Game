import { useState, useEffect } from 'react';
import { useGameViewport } from './useGameViewport';
import { Message as SpacetimeDBMessage, Player as SpacetimeDBPlayer } from '../generated';

interface SpeechBubbleManagerHookResult {
  cameraOffsetX: number;
  cameraOffsetY: number;
}

/**
 * Custom hook that manages the speech bubble system and provides camera offsets.
 * This centralizes both the camera offset logic and bubble management.
 */
export function useSpeechBubbleManager(
  localPlayer: SpacetimeDBPlayer | null | undefined
): SpeechBubbleManagerHookResult {
  // Reuse the existing viewport hook for camera offsets
  const { cameraOffsetX, cameraOffsetY } = useGameViewport(localPlayer);

  return {
    cameraOffsetX,
    cameraOffsetY
  };
} 