import React, { useState, useCallback, useRef } from 'react';
import { DragSourceSlotInfo } from '../types/dragDropTypes'; // Corrected import path
import styles from './DroppableSlot.module.css'; // We'll create this CSS file

interface DroppableSlotProps {
  children?: React.ReactNode; // Will contain DraggableItem if item exists
  className?: string; // Allow passing additional classes
  slotInfo: DragSourceSlotInfo; // Info about this slot (type, index)
  onItemDrop: (targetSlotInfo: DragSourceSlotInfo | null) => void; // Modified for null target
  // Add prop to check if currently dragging something
  isDraggingOver: boolean; // True if an item is being dragged over this slot
  style?: React.CSSProperties; // <-- Add style prop
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void; // <-- Add onClick prop
}

const DroppableSlot: React.FC<DroppableSlotProps> = ({
  children,
  className = '',
  slotInfo,
  onItemDrop,
  isDraggingOver,
  style,
  onClick, // <-- Destructure onClick
}) => {
  const slotRef = useRef<HTMLDivElement>(null);

  // Basic class construction
  const combinedClassName = `${styles.droppableSlot} ${className}`;

  // Prepare parentId attribute conditionally
  const parentIdAttr = slotInfo.parentId ? { 'data-slot-parent-id': slotInfo.parentId.toString() } : {};

  return (
    <div
      ref={slotRef}
      className={combinedClassName}
      style={style}
      data-slot-type={slotInfo.type}
      data-slot-index={slotInfo.index}
      {...parentIdAttr} // Spread the parentId attribute if it exists
      onClick={onClick} // <-- Pass onClick to the div
    >
      {children}
    </div>
  );
};

export default DroppableSlot; 