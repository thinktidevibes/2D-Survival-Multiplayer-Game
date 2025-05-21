import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook to manage player hover states for displaying username labels
 */
export function usePlayerHover() {
  // Track which player IDs are currently being hovered over
  const [hoveredPlayerIds, setHoveredPlayerIds] = useState<Set<string>>(new Set());
  
  // Track player hover timeouts to clean them up properly
  const playerHoverTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  // Cleanup timeouts when component unmounts
  useEffect(() => {
    return () => {
      // Clear all timeouts
      playerHoverTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      playerHoverTimeoutsRef.current.clear();
    };
  }, []);
  
  // Handle player hovering (show username label)
  const handlePlayerHover = useCallback((playerId: string, isHovered: boolean) => {
    if (isHovered) {
      // Clear any existing timeout for this player
      const existingTimeout = playerHoverTimeoutsRef.current.get(playerId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        playerHoverTimeoutsRef.current.delete(playerId);
      }
      
      // Add player to hovered set immediately
      setHoveredPlayerIds(prev => {
        const updated = new Set(prev);
        updated.add(playerId);
        return updated;
      });
      
    } else {
      // Only start a timeout if there isn't one already running
      if (!playerHoverTimeoutsRef.current.has(playerId)) {
        
        const timeout = setTimeout(() => {
          // Remove the player from hovered set when timeout expires
          setHoveredPlayerIds(prev => {
            const updated = new Set(prev);
            updated.delete(playerId);
            return updated;
          });
          
          // Clear this timeout from the ref
          playerHoverTimeoutsRef.current.delete(playerId);
        }, 1000); // Keep hovered state for 1 second after mouse leaves
        
        // Store the timeout reference
        playerHoverTimeoutsRef.current.set(playerId, timeout);
      }
    }
  }, []);
  
  return {
    hoveredPlayerIds,
    handlePlayerHover
  };
} 