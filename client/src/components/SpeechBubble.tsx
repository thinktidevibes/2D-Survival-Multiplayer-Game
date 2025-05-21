import React, { useEffect, useState } from 'react';

interface SpeechBubbleProps {
  message: string;
  x: number;
  y: number;
  duration?: number; // How long the bubble stays visible in ms
  maxWidth?: number;
}

const SpeechBubble: React.FC<SpeechBubbleProps> = ({ 
  message, 
  x, 
  y, 
  duration = 5000, 
  maxWidth = 200 // Slightly wider to accommodate more text
}) => {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);

  // Handle fading out and removal
  useEffect(() => {
    const fadeStartTime = duration - 1000; // Start fading 1 second before removal
    
    // Set timeout to start fading
    const fadeTimeout = setTimeout(() => {
      const fadeInterval = setInterval(() => {
        setOpacity(prev => {
          const newOpacity = prev - 0.05;
          if (newOpacity <= 0) {
            clearInterval(fadeInterval);
            return 0;
          }
          return newOpacity;
        });
      }, 50);
      
      return () => clearInterval(fadeInterval);
    }, fadeStartTime);
    
    // Set timeout to hide completely
    const hideTimeout = setTimeout(() => {
      setVisible(false);
    }, duration);
    
    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(hideTimeout);
    };
  }, [duration]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -120%)', // Moved slightly higher above head
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Dark semi-transparent background
        color: 'white',
        padding: '8px 12px',
        borderRadius: '8px',
        maxWidth: `${maxWidth}px`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
        fontFamily: '"Press Start 2P", cursive, Arial, sans-serif', // More game-like font if available
        fontSize: '12px',
        lineHeight: '1.4',
        opacity: opacity,
        pointerEvents: 'none', // Allow clicking through the bubble
        zIndex: 1000, // Make sure it appears above other elements
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        textAlign: 'center',
        border: '2px solid rgba(255, 255, 255, 0.3)', // Subtle white border
      }}
    >
      {message}
      <div
        style={{
          position: 'absolute',
          bottom: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '0',
          height: '0',
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '10px solid rgba(0, 0, 0, 0.7)', // Match background color
        }}
      />
    </div>
  );
};

export default SpeechBubble; 