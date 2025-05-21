import React, { useState, useEffect } from 'react';
import SpeechBubble from './SpeechBubble';
import { Message as SpacetimeDBMessage, Player as SpacetimeDBPlayer } from '../generated';

interface SpeechBubbleData {
  id: string;
  message: string;
  playerId: string;
  timestamp: number;
}

interface SpeechBubbleManagerProps {
  messages: Map<string, SpacetimeDBMessage>;
  players: Map<string, SpacetimeDBPlayer>;
  cameraOffsetX: number;
  cameraOffsetY: number;
  localPlayerId?: string;
}

const SpeechBubbleManager: React.FC<SpeechBubbleManagerProps> = ({
  messages,
  players,
  cameraOffsetX,
  cameraOffsetY,
  localPlayerId
}) => {
  const [activeBubbles, setActiveBubbles] = useState<SpeechBubbleData[]>([]);
  const [lastMessageCount, setLastMessageCount] = useState<number>(0);
  
  // Check for new messages and create bubbles
  useEffect(() => {
    // Only process if we have new messages
    if (messages.size > lastMessageCount) {
      // Get all messages sorted by timestamp (sent time)
      const allMessages = Array.from(messages.values())
        .sort((a, b) => Number(b.sent.microsSinceUnixEpoch - a.sent.microsSinceUnixEpoch));
      
      // Look for new messages that should trigger speech bubbles
      if (allMessages.length > 0) {
        const latestMessage = allMessages[0];
        const senderId = latestMessage.sender.toHexString();
        
        // Don't add a bubble if we already have one for this message
        const messageId = latestMessage.id.toString();
        
        // Remove any existing bubble from the same player
        // This ensures only the most recent message from each player is shown
        setActiveBubbles(prev => {
          // Filter out any bubbles from the same player
          const filteredBubbles = prev.filter(bubble => bubble.playerId !== senderId);
          
          // Add the new bubble
          return [
            ...filteredBubbles,
            {
              id: messageId,
              message: latestMessage.text,
              playerId: senderId,
              timestamp: Date.now()
            }
          ];
        });
      }
      
      setLastMessageCount(messages.size);
    }
  }, [messages, lastMessageCount]);
  
  // Clean up expired bubbles
  useEffect(() => {
    const BUBBLE_LIFETIME = 8000; // 8 seconds
    
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setActiveBubbles(prev => 
        prev.filter(bubble => now - bubble.timestamp < BUBBLE_LIFETIME)
      );
    }, 1000);
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // Render bubbles for all visible players
  return (
    <>
      {activeBubbles.map(bubble => {
        const player = players.get(bubble.playerId);
        
        // Skip if player not found or is not visible on screen
        if (!player) return null;
        
        // Calculate screen position
        const screenX = player.positionX + cameraOffsetX;
        // Position the bubble lower from player's head (was -45, now -65)
        // This puts it below where name tags appear
        const screenY = player.positionY + cameraOffsetY - 65;
        
        return (
          <SpeechBubble
            key={`speech-bubble-${bubble.id}-${bubble.timestamp}`}
            message={bubble.message}
            x={screenX}
            y={screenY}
          />
        );
      })}
    </>
  );
};

export default SpeechBubbleManager; 