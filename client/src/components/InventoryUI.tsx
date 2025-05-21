/**
 * InventoryUI.tsx
 * 
 * Displays the player's inventory, equipment, and crafting panel.
 * Also handles displaying the contents of interacted containers (Campfire, WoodenStorageBox).
 * Allows players to drag/drop items between slots, equip items, and initiate crafting.
 * Typically rendered conditionally by PlayerUI when inventory is opened or a container is interacted with.
 */

import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import styles from './InventoryUI.module.css';
// Import Custom Components
import DraggableItem from './DraggableItem';
import DroppableSlot from './DroppableSlot';

// Import from shared location
import { DragSourceSlotInfo, DraggedItemInfo } from '../types/dragDropTypes'; // Import both from shared

// Import SpacetimeDB types needed for props and logic
import {
    Player,
    InventoryItem,
    ItemDefinition,
    DbConnection,
    ActiveEquipment,
    Campfire as SpacetimeDBCampfire,
    WoodenStorageBox as SpacetimeDBWoodenStorageBox,
    Recipe,
    CraftingQueueItem,
    PlayerCorpse,
    Stash as SpacetimeDBStash,
    // Import the generated types for ItemLocation variants
    ItemLocation,
    InventoryLocationData, // Assuming this is the type for ItemLocation.Inventory.value
    EquippedLocationData,  // Assuming this is the type for ItemLocation.Equipped.value
    EquipmentSlotType    // Make sure this matches the actual exported name for the slot type enum/union
} from '../generated';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
// NEW: Import placement types
import { PlacementItemInfo} from '../hooks/usePlacementManager';
// ADD: Import CraftingUI component
import CraftingUI from './CraftingUI';
// ADD: Import ExternalContainerUI component
import ExternalContainerUI from './ExternalContainerUI';
// Import Tooltip component and its content type
import Tooltip, { TooltipContent, TooltipStats } from './Tooltip';
// Import the new formatting utility
import { formatStatDisplay } from '../utils/formatUtils';

// --- Type Definitions ---
// Define props for InventoryUI component
interface InventoryUIProps {
    playerIdentity: Identity | null;
    onClose: () => void;
    inventoryItems: Map<string, InventoryItem>;
    itemDefinitions: Map<string, ItemDefinition>;
    connection: DbConnection | null;
    activeEquipments: Map<string, ActiveEquipment>;
    onItemDragStart: (info: DraggedItemInfo) => void;
    onItemDrop: (targetSlotInfo: DragSourceSlotInfo | null) => void;
    draggedItemInfo: DraggedItemInfo | null;
    // Add new props for interaction context
    interactionTarget: { type: string; id: number | bigint } | null;
    campfires: Map<string, SpacetimeDBCampfire>;
    woodenStorageBoxes: Map<string, SpacetimeDBWoodenStorageBox>; // <<< ADDED Prop Definition
    playerCorpses: Map<string, PlayerCorpse>; // <<< ADD prop definition for corpses
    stashes: Map<string, SpacetimeDBStash>; // <<< ADDED stashes prop
    currentStorageBox?: SpacetimeDBWoodenStorageBox | null; // <<< ADDED Prop Definition
    // NEW: Add Generic Placement Props
    startPlacement: (itemInfo: PlacementItemInfo) => void;
    cancelPlacement: () => void; // Assuming cancel might be needed (e.g., close button cancels placement)
    placementInfo: PlacementItemInfo | null; // To potentially disable actions while placing
    // ADD: Crafting related props
    recipes: Map<string, Recipe>;
    craftingQueueItems: Map<string, CraftingQueueItem>;
    onCraftingSearchFocusChange?: (isFocused: boolean) => void;
}

// Represents an item instance with its definition for rendering
export interface PopulatedItem {
    instance: InventoryItem;
    definition: ItemDefinition;
}

// --- Constants ---
const NUM_FUEL_SLOTS = 5; // For Campfire
const NUM_BOX_SLOTS = 18; // For Wooden Storage Box
const BOX_COLS = 6;
const INVENTORY_ROWS = 4;
const INVENTORY_COLS = 6;
const TOTAL_INVENTORY_SLOTS = INVENTORY_ROWS * INVENTORY_COLS;

// Define Equipment Slot Layout (matches enum variants/logical names)
const EQUIPMENT_SLOT_LAYOUT: { name: string, type: EquipmentSlotType | null }[] = [
    { name: 'Head', type: { tag: 'Head' } as EquipmentSlotType },
    { name: 'Chest', type: { tag: 'Chest' } as EquipmentSlotType },
    { name: 'Legs', type: { tag: 'Legs' } as EquipmentSlotType },
    { name: 'Feet', type: { tag: 'Feet' } as EquipmentSlotType },
    { name: 'Hands', type: { tag: 'Hands' } as EquipmentSlotType },
    { name: 'Back', type: { tag: 'Back' } as EquipmentSlotType },
];

// --- Main Component ---
const InventoryUI: React.FC<InventoryUIProps> = ({
    playerIdentity,
    onClose,
    inventoryItems,
    itemDefinitions,
    connection,
    activeEquipments,
    onItemDragStart,
    onItemDrop,
    draggedItemInfo,
    interactionTarget,
    campfires,
    woodenStorageBoxes,
    playerCorpses,
    stashes,
    currentStorageBox,
    startPlacement,
    cancelPlacement,
    placementInfo,
    recipes,
    craftingQueueItems,
    onCraftingSearchFocusChange,
}) => {
    const isPlacingItem = placementInfo !== null;
    const prevInteractionTargetRef = useRef<typeof interactionTarget | undefined>(undefined);
    const inventoryPanelRef = useRef<HTMLDivElement>(null); // Ref for the main panel

    // Tooltip State
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [tooltipContent, setTooltipContent] = useState<TooltipContent | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    // Memoized handleClose to ensure stability if its dependencies are stable.
    const handleClose = useCallback(() => {
        if (isPlacingItem) {
            cancelPlacement();
        }
        onClose();
    }, [isPlacingItem, cancelPlacement, onClose]);

    useEffect(() => {
        // console.log('[InventoryUI Effect] Current interactionTarget:', interactionTarget);
        // console.log('[InventoryUI Effect] Previous interactionTarget from ref:', prevInteractionTargetRef.current);

        // If there was a defined interactionTarget in the previous render,
        // and now there isn't (interactionTarget is null or undefined),
        // it means the player has moved away or the target is no longer valid.
        // In this case, automatically close the inventory.
        if (prevInteractionTargetRef.current && !interactionTarget) {
            // console.log('[InventoryUI] Interaction target lost, auto-closing inventory. Calling handleClose.');
            handleClose();
        }
        // Update the ref to the current value for the next render cycle.
        prevInteractionTargetRef.current = interactionTarget;
    }, [interactionTarget, handleClose]);

    // --- Derived State & Data Preparation --- 

    // Player Inventory & Equipment Data
    const { itemsByInvSlot, itemsByEquipSlot } = useMemo(() => {
        const invMap = new Map<number, PopulatedItem>();
        const equipMap = new Map<string, PopulatedItem>();
        if (!playerIdentity) return { itemsByInvSlot: invMap, itemsByEquipSlot: equipMap };

        inventoryItems.forEach(itemInstance => {
            const definition = itemDefinitions.get(itemInstance.itemDefId.toString());
            if (definition) {
                const populatedItem = { instance: itemInstance, definition };
                const location = itemInstance.location; // Get location once

                if (location.tag === 'Inventory') {
                    // No need for type assertion if TypeScript can infer from .tag, but explicit for clarity if needed
                    const inventoryData = location.value as InventoryLocationData;
                    if (inventoryData.ownerId.isEqual(playerIdentity)) {
                        invMap.set(inventoryData.slotIndex, populatedItem);
                    }
                } else if (location.tag === 'Equipped') {
                    // No need for type assertion if TypeScript can infer, but explicit for clarity
                    const equipmentData = location.value as EquippedLocationData;
                    if (equipmentData.ownerId.isEqual(playerIdentity)) {
                        // equipmentData.slotType will be like { tag: 'Head' } or { tag: 'Chest', value: ... }
                        // We need the string tag for the map key
                        equipMap.set(equipmentData.slotType.tag, populatedItem);
                    }
                }
            }
        });
        return { itemsByInvSlot: invMap, itemsByEquipSlot: equipMap };
    }, [playerIdentity, inventoryItems, itemDefinitions]);

    // --- Callbacks & Handlers ---
    const handleItemMouseEnter = useCallback((item: PopulatedItem, event: React.MouseEvent<HTMLDivElement>) => {
        if (inventoryPanelRef.current) {
            const panelRect = inventoryPanelRef.current.getBoundingClientRect();
            const relativeX = event.clientX - panelRect.left;
            const relativeY = event.clientY - panelRect.top;

            // const rect = event.currentTarget.getBoundingClientRect(); // CurrentTarget is the DraggableItem
            // console.log('[Tooltip Debug] event.clientX:', event.clientX, 'panelRect.left:', panelRect.left, 'relativeX:', relativeX);
            // console.log('[Tooltip Debug] Hovered Item:', item.definition.name);

            const stats: TooltipStats[] = [];
            const def = item.definition;

            const categoryTag = def.category.tag;

            if (categoryTag === 'Tool') {
                // Primary Yield for Tools
                if (def.primaryTargetYieldMin !== undefined || def.primaryTargetYieldMax !== undefined) {
                    const min = def.primaryTargetYieldMin ?? 0;
                    const max = def.primaryTargetYieldMax ?? min;
                    let yieldLabel = 'Primary Yield';
                    if (def.primaryTargetType) {
                        yieldLabel = `${def.primaryTargetType.tag} Yield`;
                    }
                    stats.push({ label: yieldLabel, value: max > min ? `${min}-${max}` : `${min}` });
                }
                // Secondary Yield for Tools
                if (def.secondaryTargetYieldMin !== undefined || def.secondaryTargetYieldMax !== undefined) {
                    const min = def.secondaryTargetYieldMin ?? 0;
                    const max = def.secondaryTargetYieldMax ?? min;
                    let yieldLabel = 'Secondary Yield';
                    if (def.secondaryTargetType) {
                        yieldLabel = `${def.secondaryTargetType.tag} Yield`;
                    }
                    stats.push({ label: yieldLabel, value: max > min ? `${min}-${max}` : `${min}` });
                }
            } else {    
                // Weapon Stats (Primary Damage - for non-tools or tools that also have direct damage)
                if (def.primaryTargetDamageMin !== undefined || def.primaryTargetDamageMax !== undefined) {
                    const min = def.primaryTargetDamageMin ?? 0;
                    const max = def.primaryTargetDamageMax ?? min;
                    stats.push({ label: 'Damage', value: max > min ? `${min}-${max}` : `${min}` });
                }
            }

            // Weapon Stats (PvP) - could be combined or separate
            if (def.pvpDamageMin !== undefined || def.pvpDamageMax !== undefined) {
                const min = def.pvpDamageMin ?? 0;
                const max = def.pvpDamageMax ?? min;
                stats.push({ label: 'Damage', value: max > min ? `${min}-${max}` : `${min}` });
            }
            if (def.bleedDamagePerTick !== undefined && def.bleedDamagePerTick > 0 && def.bleedDurationSeconds !== undefined) {
                stats.push({ label: 'Bleed', value: `${def.bleedDamagePerTick}/tick for ${def.bleedDurationSeconds}s` });
            }

            // Armor Stats
            if (def.damageResistance !== undefined && def.damageResistance > 0) {
                stats.push({ label: 'Defense', value: formatStatDisplay(def.damageResistance * 100, true) });
            }
            if (def.warmthBonus !== undefined && def.warmthBonus !== 0) {
                stats.push({ label: 'Warmth', value: formatStatDisplay(def.warmthBonus), color: def.warmthBonus > 0 ? '#f0ad4e' : '#5bc0de' });
            }

            // Consumable Stats
            if (def.consumableHealthGain !== undefined && def.consumableHealthGain !== 0) {
                stats.push({ label: 'Health', value: `${def.consumableHealthGain > 0 ? '+' : ''}${def.consumableHealthGain}`, color: def.consumableHealthGain > 0 ? '#5cb85c' : '#d9534f' });
            }
            if (def.consumableHungerSatiated !== undefined && def.consumableHungerSatiated !== 0) {
                stats.push({ label: 'Hunger', value: `${def.consumableHungerSatiated > 0 ? '+' : ''}${def.consumableHungerSatiated}`, color: '#f0ad4e' });
            }
            if (def.consumableThirstQuenched !== undefined && def.consumableThirstQuenched !== 0) {
                stats.push({ label: 'Thirst', value: `${def.consumableThirstQuenched > 0 ? '+' : ''}${def.consumableThirstQuenched}`, color: '#5bc0de' });
            }
            if (def.consumableStaminaGain !== undefined && def.consumableStaminaGain !== 0) {
                stats.push({ label: 'Stamina', value: `${def.consumableStaminaGain > 0 ? '+' : ''}${def.consumableStaminaGain}`, color: '#5cb85c' });
            }
            if (def.consumableDurationSecs !== undefined && def.consumableDurationSecs > 0) {
                stats.push({ label: 'Duration', value: `${def.consumableDurationSecs}s` });
            }
            
            // Fuel Stats
            if (def.fuelBurnDurationSecs !== undefined && def.fuelBurnDurationSecs > 0) {
                stats.push({ label: 'Burn Time', value: `${def.fuelBurnDurationSecs}s` });
            }

            const content: TooltipContent = {
                name: def.name,
                description: def.description,
                category: def.category.tag,
                // Rarity needs to be determined, for now, undefined
                rarity: undefined, // Placeholder - implement rarity logic if available or desired
                stats: stats.length > 0 ? stats : undefined,
            };

            setTooltipContent(content);
            setTooltipPosition({ x: relativeX, y: relativeY });
            setTooltipVisible(true);
        }
    }, []); // Dependency array is empty as panelRef and item details are stable or derived within

    const handleItemMouseLeave = useCallback(() => {
        setTooltipVisible(false);
        setTooltipContent(null);
    }, []);

    const handleItemMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (inventoryPanelRef.current && tooltipVisible) { // Only update if visible and panel exists
            const panelRect = inventoryPanelRef.current.getBoundingClientRect();
            const relativeX = event.clientX - panelRect.left;
            const relativeY = event.clientY - panelRect.top;
            setTooltipPosition({ x: relativeX, y: relativeY });
        }
    }, [tooltipVisible]); // Depend on tooltipVisible to avoid unnecessary calculations

    const handleInventoryItemContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>, itemInfo: PopulatedItem) => {
        event.preventDefault();
        if (!connection?.reducers || !itemInfo) return;
        const itemInstanceId = BigInt(itemInfo.instance.instanceId);

        // Get interaction context directly here
        const currentInteraction = interactionTarget;
        const currentBoxId = currentInteraction?.type === 'wooden_storage_box' ? Number(currentInteraction.id) : null;
        const currentCampfireId = currentInteraction?.type === 'campfire' ? Number(currentInteraction.id) : null;
        const currentCorpseId = currentInteraction?.type === 'player_corpse' ? Number(currentInteraction.id) : null;
        const currentStashId = currentInteraction?.type === 'stash' ? Number(currentInteraction.id) : null;

        // --- PRIORITY 1: Open Corpse ---
        if (currentCorpseId !== null) {
            try {
                console.log(`[Inv CtxMenu Inv->Corpse] Corpse ${currentCorpseId} open. Calling quickMoveToCorpse for item ${itemInstanceId}`);
                connection.reducers.quickMoveToCorpse(currentCorpseId, itemInstanceId);
            } catch (e: any) { 
                console.error("[Inv CtxMenu Inv->Corpse] Error quick moving to corpse:", e); 
                // TODO: setUiError 
            }
            return; // Action handled
        }

        // --- PRIORITY 2: Open Box --- 
        if (currentBoxId !== null) {
            try { 
                // console.log(`[Inv CtxMenu Inv->Box] Box ${currentBoxId} open. Calling quickMoveToBox for item ${itemInstanceId}`);
                connection.reducers.quickMoveToBox(currentBoxId, itemInstanceId); 
            } catch (e: any) { 
                console.error("[Inv CtxMenu Inv->Box]", e); 
                // TODO: setUiError 
            }
            return; // Action handled
        } 
        // --- PRIORITY 3: Open Stash ---
        else if (currentStashId !== null) {
            const stashEntity = stashes.get(currentStashId.toString());
            if (stashEntity && !stashEntity.isHidden) {
                try {
                    console.log(`[Inv CtxMenu Inv->Stash] Stash ${currentStashId} open. Calling quickMoveToStash for item ${itemInstanceId}`);
                    connection.reducers.quickMoveToStash(currentStashId, itemInstanceId);
                } catch (e: any) {
                    console.error(`[Inv CtxMenu Inv->Stash] Error quick moving item ${itemInstanceId} to stash ${currentStashId}:`, e);
                    // TODO: setUiError
                }
            } else {
                console.log(`[Inv CtxMenu Inv->Stash] Stash ${currentStashId} is hidden. Cannot quick move.`);
                // Optionally set a UI error here to inform the player
            }
            return; // Action handled (or intentionally not handled if hidden)
        }
        // --- PRIORITY 4: Open Campfire --- 
        else if (currentCampfireId !== null) {
            try { 
                // console.log(`[Inv CtxMenu Inv->Campfire] Campfire ${currentCampfireId} open. Calling quickMoveToCampfire for item ${itemInstanceId}`);
                connection.reducers.quickMoveToCampfire(currentCampfireId, itemInstanceId); 
            } catch (e: any) { 
                console.error("[Inv CtxMenu Inv->Campfire]", e); 
                // TODO: setUiError 
            }
            return; // Action handled
        } 
        // --- DEFAULT ACTIONS (No relevant container open) --- 
        else {
            const isArmor = itemInfo.definition.category.tag === 'Armor' && itemInfo.definition.equipmentSlotType !== null;
            if (isArmor) {
                // console.log(`[Inv CtxMenu EquipArmor] No container open. Item ${itemInstanceId} is Armor. Calling equipArmorFromInventory.`);
                try { connection.reducers.equipArmorFromInventory(itemInstanceId); } catch (e: any) { console.error("[Inv CtxMenu EquipArmor]", e); /* TODO: setUiError */ }
            } else {
                // console.log(`[Inv CtxMenu Inv->Hotbar] No container open. Item ${itemInstanceId} not Armor. Calling moveToFirstAvailableHotbarSlot.`);
                try { connection.reducers.moveToFirstAvailableHotbarSlot(itemInstanceId); } catch (e: any) { console.error("[Inv CtxMenu Inv->Hotbar]", e); /* TODO: setUiError */ }
            }
        }
    }, [connection, interactionTarget, stashes]);

    // Helper function to format stat numbers
    const formatStatDisplay = (value: number, isPercentage: boolean = false, signed: boolean = true): string => {
        const roundedValue = Math.round(value * 10) / 10;
        const sign = signed && roundedValue > 0 ? '+' : '';
        const percentage = isPercentage ? '%' : '';
        return `${sign}${roundedValue}${percentage}`;
    };

    // These handlers will be identical to the ones above but are explicitly for external items
    // to avoid any potential confusion if we ever needed to differentiate them.
    const handleExternalItemMouseEnter = useCallback((item: PopulatedItem, event: React.MouseEvent<HTMLDivElement>) => {
        if (inventoryPanelRef.current) {
            const panelRect = inventoryPanelRef.current.getBoundingClientRect();
            const relativeX = event.clientX - panelRect.left;
            const relativeY = event.clientY - panelRect.top;

            const stats: TooltipStats[] = [];
            const def = item.definition;
            const categoryTag = def.category.tag;

            if (categoryTag === 'Tool') {
                // Primary Yield for Tools
                if (def.primaryTargetYieldMin !== undefined || def.primaryTargetYieldMax !== undefined) {
                    const min = def.primaryTargetYieldMin ?? 0;
                    const max = def.primaryTargetYieldMax ?? min;
                    let yieldLabel = 'Primary Yield';
                    if (def.primaryTargetType) {
                        yieldLabel = `${def.primaryTargetType.tag} Yield`;
                    }
                    stats.push({ label: yieldLabel, value: max > min ? `${min}-${max}` : `${min}` });
                }
                // Secondary Yield for Tools
                if (def.secondaryTargetYieldMin !== undefined || def.secondaryTargetYieldMax !== undefined) {
                    const min = def.secondaryTargetYieldMin ?? 0;
                    const max = def.secondaryTargetYieldMax ?? min;
                    let yieldLabel = 'Secondary Yield';
                    if (def.secondaryTargetType) {
                        yieldLabel = `${def.secondaryTargetType.tag} Yield`;
                    }
                    stats.push({ label: yieldLabel, value: max > min ? `${min}-${max}` : `${min}` });
                }
            } else {
                // Weapon Stats (Primary Damage)
                if (def.primaryTargetDamageMin !== undefined || def.primaryTargetDamageMax !== undefined) {
                    const min = def.primaryTargetDamageMin ?? 0;
                    const max = def.primaryTargetDamageMax ?? min;
                    stats.push({ label: 'Damage', value: max > min ? `${min}-${max}` : `${min}` });
                }
            }
            
            // Weapon Stats (PvP Damage)
            if (def.pvpDamageMin !== undefined || def.pvpDamageMax !== undefined) {
                const min = def.pvpDamageMin ?? 0;
                const max = def.pvpDamageMax ?? min;
                stats.push({ label: 'PvP Damage', value: max > min ? `${min}-${max}` : `${min}` });
            }
            if (def.bleedDamagePerTick !== undefined && def.bleedDamagePerTick > 0 && def.bleedDurationSeconds !== undefined) {
                stats.push({ label: 'Bleed', value: `${def.bleedDamagePerTick}/tick for ${def.bleedDurationSeconds}s` });
            }

            // Armor Stats
            if (def.damageResistance !== undefined && def.damageResistance > 0) {
                stats.push({ label: 'Defense', value: formatStatDisplay(def.damageResistance * 100, true) });
            }
            if (def.warmthBonus !== undefined && def.warmthBonus !== 0) {
                stats.push({ label: 'Warmth', value: formatStatDisplay(def.warmthBonus), color: def.warmthBonus > 0 ? '#f0ad4e' : '#5bc0de' });
            }

            // Consumable Stats
            if (def.consumableHealthGain !== undefined && def.consumableHealthGain !== 0) {
                stats.push({ label: 'Health', value: `${def.consumableHealthGain > 0 ? '+' : ''}${def.consumableHealthGain}`, color: def.consumableHealthGain > 0 ? '#5cb85c' : '#d9534f' });
            }
            if (def.consumableHungerSatiated !== undefined && def.consumableHungerSatiated !== 0) {
                stats.push({ label: 'Hunger', value: `${def.consumableHungerSatiated > 0 ? '+' : ''}${def.consumableHungerSatiated}`, color: '#f0ad4e' });
            }
            if (def.consumableThirstQuenched !== undefined && def.consumableThirstQuenched !== 0) {
                stats.push({ label: 'Thirst', value: `${def.consumableThirstQuenched > 0 ? '+' : ''}${def.consumableThirstQuenched}`, color: '#5bc0de' });
            }
            if (def.consumableStaminaGain !== undefined && def.consumableStaminaGain !== 0) {
                stats.push({ label: 'Stamina', value: `${def.consumableStaminaGain > 0 ? '+' : ''}${def.consumableStaminaGain}`, color: '#5cb85c' });
            }
            if (def.consumableDurationSecs !== undefined && def.consumableDurationSecs > 0) {
                stats.push({ label: 'Duration', value: `${def.consumableDurationSecs}s` });
            }
            if (def.fuelBurnDurationSecs !== undefined && def.fuelBurnDurationSecs > 0) {
                stats.push({ label: 'Burn Time', value: `${def.fuelBurnDurationSecs}s` });
            }

            const content: TooltipContent = {
                name: def.name,
                description: def.description,
                category: def.category.tag,
                rarity: undefined, 
                stats: stats.length > 0 ? stats : undefined,
            };

            setTooltipContent(content);
            setTooltipPosition({ x: relativeX, y: relativeY });
            setTooltipVisible(true);
        }
    }, []);

    const handleExternalItemMouseLeave = useCallback(() => {
        setTooltipVisible(false);
        setTooltipContent(null);
    }, []);

    const handleExternalItemMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (inventoryPanelRef.current && tooltipVisible) {
            const panelRect = inventoryPanelRef.current.getBoundingClientRect();
            const relativeX = event.clientX - panelRect.left;
            const relativeY = event.clientY - panelRect.top;
            setTooltipPosition({ x: relativeX, y: relativeY });
        }
    }, [tooltipVisible]);

    // --- Render --- 
    return (
        <div ref={inventoryPanelRef} data-id="inventory-panel" className={styles.inventoryPanel}>
            <button className={styles.closeButton} onClick={handleClose}>X</button>

            {/* Left Pane: Equipment */} 
            <div className={styles.leftPane}>
                <h3 className={styles.sectionTitle}>EQUIPMENT</h3>
                <div className={styles.equipmentGrid}>
                    {EQUIPMENT_SLOT_LAYOUT.map(slotInfo => {
                        const item = itemsByEquipSlot.get(slotInfo.name);
                        const currentSlotInfo: DragSourceSlotInfo = { type: 'equipment', index: slotInfo.name };
                        return (
                            <div className={styles.equipmentSlot}>
                                <DroppableSlot
                                    key={`equip-${slotInfo.name}`}
                                    slotInfo={currentSlotInfo}
                                    onItemDrop={onItemDrop}
                                    className={styles.slot}
                                    isDraggingOver={false} // Add state if needed
                                >
                                    {item && (
                                        <DraggableItem
                                            item={item}
                                            sourceSlot={currentSlotInfo}
                                            onItemDragStart={onItemDragStart}
                                            onItemDrop={onItemDrop}
                                            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => handleItemMouseEnter(item, e)}
                                            onMouseLeave={handleItemMouseLeave}
                                            onMouseMove={handleItemMouseMove}
                                            // No context menu needed for equipped items? Or move back to inv?
                                        />
                                    )}
                                </DroppableSlot>
                                <div className={styles.slotLabel}>{slotInfo.name}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Middle Pane: Inventory & Containers */} 
            <div className={styles.middlePane}>
                <h3 className={styles.sectionTitle}>INVENTORY</h3>
                <div className={styles.inventoryGrid}>
                    {Array.from({ length: TOTAL_INVENTORY_SLOTS }).map((_, index) => {
                        const item = itemsByInvSlot.get(index);
                        const currentSlotInfo: DragSourceSlotInfo = { type: 'inventory', index: index };
                        return (
                            <DroppableSlot
                                key={`inv-${index}`}
                                slotInfo={currentSlotInfo}
                                onItemDrop={onItemDrop}
                                className={styles.slot}
                                isDraggingOver={false} // Add state if needed
                            >
                                {item && (
                                    <DraggableItem
                                        item={item}
                                        sourceSlot={currentSlotInfo}
                                        onItemDragStart={onItemDragStart}
                                        onItemDrop={onItemDrop}
                                        onContextMenu={(event) => handleInventoryItemContextMenu(event, item)}
                                        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => handleItemMouseEnter(item, e)}
                                        onMouseLeave={handleItemMouseLeave}
                                        onMouseMove={handleItemMouseMove}
                                    />
                                )}
                            </DroppableSlot>
                        );
                    })}
                </div>
                </div>

            {/* Right Pane: Always shows External Container if interacting */}
            <div className={styles.rightPane}> {/* Ensure rightPane class exists if needed */}
                {interactionTarget ? (
                    // If interacting, show the external container
                <ExternalContainerUI
                    interactionTarget={interactionTarget}
                    inventoryItems={inventoryItems}
                    itemDefinitions={itemDefinitions}
                    campfires={campfires}
                    woodenStorageBoxes={woodenStorageBoxes}
                    playerCorpses={playerCorpses}
                    stashes={stashes}
                    currentStorageBox={currentStorageBox}
                    connection={connection}
                    onItemDragStart={onItemDragStart}
                    onItemDrop={onItemDrop}
                    playerId={playerIdentity ? playerIdentity.toHexString() : null}
                    onExternalItemMouseEnter={handleExternalItemMouseEnter}
                    onExternalItemMouseLeave={handleExternalItemMouseLeave}
                    onExternalItemMouseMove={handleExternalItemMouseMove}
                />
                ) : (
                    // Otherwise, show the crafting UI
            <CraftingUI
                playerIdentity={playerIdentity}
                recipes={recipes}
                craftingQueueItems={craftingQueueItems}
                itemDefinitions={itemDefinitions}
                inventoryItems={inventoryItems}
                connection={connection}
                onCraftingSearchFocusChange={onCraftingSearchFocusChange}
            />
                )}
            </div>
            <Tooltip content={tooltipContent} visible={tooltipVisible} position={tooltipPosition} />
        </div>
    );
};

export default InventoryUI;