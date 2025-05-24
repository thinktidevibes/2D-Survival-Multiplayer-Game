import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, InventoryItem, ItemDefinition, DbConnection, ActiveEquipment, Campfire as SpacetimeDBCampfire, WoodenStorageBox as SpacetimeDBWoodenStorageBox, Recipe, CraftingQueueItem, PlayerCorpse, StatThresholdsConfig, Stash as SpacetimeDBStash, ActiveConsumableEffect } from '../generated';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import InventoryUI, { PopulatedItem } from './InventoryUI';
import Hotbar from './Hotbar';
import StatusBar from './StatusBar';
import { itemIcons } from '../utils/itemIconUtils';
// Import drag/drop types from shared file
import { DragSourceSlotInfo, DraggedItemInfo } from '../types/dragDropTypes';
// NEW: Import placement types
import { PlacementItemInfo, PlacementState, PlacementActions } from '../hooks/usePlacementManager';
import { InteractionTarget } from '../hooks/useInteractionManager';

// --- NEW IMPORTS ---
import { NotificationItem } from '../types/notifications';
import ItemAcquisitionNotificationUI from './ItemAcquisitionNotificationUI';
import { useAuth } from '../contexts/AuthContext';
// --- END NEW IMPORTS ---

interface PlayerUIProps {
  identity: Identity | null;
  players: Map<string, Player>;
  inventoryItems: Map<string, InventoryItem>;
  itemDefinitions: Map<string, ItemDefinition>;
  connection: DbConnection | null;
  onItemDragStart: (info: DraggedItemInfo) => void;
  onItemDrop: (targetSlotInfo: DragSourceSlotInfo | null) => void;
  draggedItemInfo: DraggedItemInfo | null;
  activeEquipments: Map<string, ActiveEquipment>;
  activeConsumableEffects: Map<string, ActiveConsumableEffect>;
  campfires: Map<string, SpacetimeDBCampfire>;
  onSetInteractingWith: (target: InteractionTarget) => void;
  interactingWith: InteractionTarget;
  startPlacement: (itemInfo: PlacementItemInfo) => void;
  cancelPlacement: () => void;
  placementInfo: PlacementItemInfo | null;
  currentStorageBox?: SpacetimeDBWoodenStorageBox | null;
  recipes: Map<string, Recipe>;
  craftingQueueItems: Map<string, CraftingQueueItem>;
  woodenStorageBoxes: Map<string, SpacetimeDBWoodenStorageBox>;
  playerCorpses: Map<string, PlayerCorpse>;
  stashes: Map<string, SpacetimeDBStash>;
  onCraftingSearchFocusChange?: (isFocused: boolean) => void;
  showInventory: boolean;
  onToggleInventory: () => void;
}

const PlayerUI: React.FC<PlayerUIProps> = ({
    identity,
    players,
    inventoryItems,
    itemDefinitions,
    connection,
    onItemDragStart,
    onItemDrop,
    draggedItemInfo,
    activeEquipments,
    activeConsumableEffects,
    campfires,
    onSetInteractingWith,
    interactingWith,
    startPlacement,
    cancelPlacement,
    placementInfo,
    currentStorageBox,
    recipes,
    craftingQueueItems,
    woodenStorageBoxes,
    playerCorpses,
    stashes,
    onCraftingSearchFocusChange,
    showInventory,
    onToggleInventory
 }) => {
    const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
    const [lowNeedThreshold, setLowNeedThreshold] = useState<number>(20.0);
    // --- NEW STATE FOR NOTIFICATIONS ---
    const [acquisitionNotifications, setAcquisitionNotifications] = useState<NotificationItem[]>([]);
    const NOTIFICATION_DURATION = 3000; // ms
    const FADE_OUT_ANIMATION_DURATION = 500; // ms for fade-out animation
    const MAX_NOTIFICATIONS_DISPLAYED = 5;
    // --- END NEW STATE ---

    // Reference to store the previous state of inventory items for comparison
    const prevInventoryRef = useRef<Map<string, InventoryItem>>(new Map());

    const { logout } = useAuth();

    // Determine if there's an active health regen effect for the local player
    const isHealthHealingOverTime = React.useMemo(() => {
        if (!localPlayer || !activeConsumableEffects || activeConsumableEffects.size === 0) return false;
        
        const localPlayerIdHex = localPlayer.identity.toHexString();
        // console.log(`[PlayerUI] Checking active effects for player: ${localPlayerIdHex}`);

        let foundMatch = false;
        activeConsumableEffects.forEach((effect, key) => {
            const effectPlayerIdHex = effect.playerId.toHexString();
            const effectTypeTag = effect.effectType ? (effect.effectType as any).tag : 'undefined';
            
            // console.log(`[PlayerUI] Effect ID ${key}: player ID matches: ${effectPlayerIdHex === localPlayerIdHex}, type tag: ${effectTypeTag}`);

            if (effectPlayerIdHex === localPlayerIdHex && effectTypeTag === 'HealthRegen') {
                // console.log(`[PlayerUI] Found matching HealthRegen effect:`, effect);
                foundMatch = true;
            }
        });

        return foundMatch;
    }, [localPlayer, activeConsumableEffects]);

    // Determine if there's an active bleed effect for the local player
    const isPlayerBleeding = React.useMemo(() => {
        if (!localPlayer || !activeConsumableEffects || activeConsumableEffects.size === 0) return false;

        const localPlayerIdHex = localPlayer.identity.toHexString();
        let foundMatch = false;
        activeConsumableEffects.forEach((effect) => {
            const effectPlayerIdHex = effect.playerId.toHexString();
            const effectTypeTag = effect.effectType ? (effect.effectType as any).tag : 'undefined';

            // console.log(`[PlayerUI - isPlayerBleeding] Checking effect: PlayerID=${effectPlayerIdHex}, LocalPlayerID=${localPlayerIdHex}, EffectTypeTag='${effectTypeTag}'`);

            if (effectPlayerIdHex === localPlayerIdHex && effectTypeTag === 'Bleed') {
                foundMatch = true;
                // console.log("[PlayerUI - isPlayerBleeding] Bleed effect FOUND for local player.");
            }
        });
        return foundMatch;
    }, [localPlayer, activeConsumableEffects]);

    // Determine if there's an active BandageBurst effect and its potential heal amount
    const pendingBandageHealAmount = React.useMemo(() => {
        if (!localPlayer || !activeConsumableEffects || activeConsumableEffects.size === 0) return 0;

        const localPlayerIdHex = localPlayer.identity.toHexString();
        let potentialHeal = 0;
        activeConsumableEffects.forEach((effect) => {
            const effectPlayerIdHex = effect.playerId.toHexString();
            const effectTypeTag = effect.effectType ? (effect.effectType as any).tag : 'undefined';

            if (effectPlayerIdHex === localPlayerIdHex && effectTypeTag === 'BandageBurst') {
                potentialHeal = effect.totalAmount || 0; // Use totalAmount from the effect
            }
        });
        return potentialHeal;
    }, [localPlayer, activeConsumableEffects]);

    useEffect(() => {
        if (!identity) {
            setLocalPlayer(null);
            return;
        }
        const player = players.get(identity.toHexString());
        setLocalPlayer(player || null);
    }, [identity, players]);

    useEffect(() => {
        if (!connection) return;

        const handleStatThresholdsConfig = (config: StatThresholdsConfig | null | undefined) => {
            if (config && typeof config.lowNeedThreshold === 'number') {
                setLowNeedThreshold(config.lowNeedThreshold);
                console.log('StatThresholdsConfig: low_need_threshold set to', config.lowNeedThreshold);
            }
        };

        const configIterable = connection.db.statThresholdsConfig.iter();
        const initialConfigArray = Array.from(configIterable);
        const initialConfig = initialConfigArray.length > 0 ? initialConfigArray[0] : undefined;
        
        if (initialConfig) {
            handleStatThresholdsConfig(initialConfig);
        }

        const onInsertConfigCallback = (ctx: any, config: StatThresholdsConfig) => handleStatThresholdsConfig(config);
        const onUpdateConfigCallback = (ctx: any, oldConfig: StatThresholdsConfig, newConfig: StatThresholdsConfig) => handleStatThresholdsConfig(newConfig);
        const onDeleteConfigCallback = () => {
            console.warn('StatThresholdsConfig row deleted from server. Reverting to default low_need_threshold (20.0).');
            setLowNeedThreshold(20.0);
        };

        connection.db.statThresholdsConfig.onInsert(onInsertConfigCallback);
        connection.db.statThresholdsConfig.onUpdate(onUpdateConfigCallback);
        connection.db.statThresholdsConfig.onDelete(onDeleteConfigCallback);

        return () => {
            connection.db.statThresholdsConfig.removeOnInsert(onInsertConfigCallback);
            connection.db.statThresholdsConfig.removeOnUpdate(onUpdateConfigCallback);
            connection.db.statThresholdsConfig.removeOnDelete(onDeleteConfigCallback);
        };
    }, [connection]);

    // --- NEW: HELPER TO ADD ACQUISITION NOTIFICATIONS ---
    const addAcquisitionNotification = useCallback((itemDefId: bigint, quantityChange: number) => {
        if (!itemDefinitions || quantityChange <= 0 || !connection || !identity) return;

        const def = itemDefinitions.get(itemDefId.toString());
        if (!def) {
            console.warn(`No item definition found for ID: ${itemDefId}`);
            return;
        }

        let currentTotalInInventory: number | undefined = undefined;

        if (def.category.tag === 'Material') {
            let total = 0;
            const playerIdentityHex = identity.toHexString();
            for (const invItem of connection.db.inventoryItem.iter()) {
                if (invItem.itemDefId === itemDefId) {
                    if (invItem.location.tag === 'Inventory' && invItem.location.value.ownerId.toHexString() === playerIdentityHex) {
                        total += invItem.quantity;
                    } else if (invItem.location.tag === 'Hotbar' && invItem.location.value.ownerId.toHexString() === playerIdentityHex) {
                        total += invItem.quantity;
                    }
                }
            }
            currentTotalInInventory = total;
        }

        const newNotification: NotificationItem = {
            id: `${Date.now()}-${Math.random()}`, // Simple unique ID
            itemDefId: itemDefId,
            itemName: def.name,
            itemIcon: def.iconAssetName,
            quantityChange: quantityChange,
            currentTotalInInventory: currentTotalInInventory, // Add the calculated total here
            timestamp: Date.now(),
            isFadingOut: false, // Initialize as not fading out
        };

        setAcquisitionNotifications(prevNotifications => {
            const updatedNotifications = [...prevNotifications, newNotification];
            return updatedNotifications; 
        });

        // First timeout: Mark for fade-out
        setTimeout(() => {
            setAcquisitionNotifications(prev =>
                prev.map(n => 
                    n.id === newNotification.id ? { ...n, isFadingOut: true } : n
                )
            );
            // Second timeout: Actually remove after fade-out animation completes
            setTimeout(() => {
                setAcquisitionNotifications(prev => prev.filter(n => n.id !== newNotification.id));
            }, FADE_OUT_ANIMATION_DURATION);
        }, NOTIFICATION_DURATION);

    }, [itemDefinitions, connection, identity]);
    // --- END NEW HELPER ---

    // --- REVISED: EFFECT FOR INVENTORY ITEM CHANGES (ACQUISITION NOTIFICATIONS) ---
    useEffect(() => {
        if (!connection || !identity || !itemDefinitions || !inventoryItems) return;

        const localPlayerIdHex = identity.toHexString();
        const currentInventorySnapshot = new Map(inventoryItems);

        const currentTotals = new Map<string, number>(); // itemDefId_str -> quantity
        const previousTotals = new Map<string, number>(); // itemDefId_str -> quantity

        // Calculate current totals for player from the live inventoryItems prop
        currentInventorySnapshot.forEach(item => {
            if ((item.location.tag === 'Inventory' || item.location.tag === 'Hotbar') && item.location.value.ownerId.toHexString() === localPlayerIdHex) {
                const defId = item.itemDefId.toString();
                currentTotals.set(defId, (currentTotals.get(defId) || 0) + item.quantity);
            }
        });

        // Calculate previous totals for player from the stored ref
        prevInventoryRef.current.forEach(item => {
            if ((item.location.tag === 'Inventory' || item.location.tag === 'Hotbar') && item.location.value.ownerId.toHexString() === localPlayerIdHex) {
                const defId = item.itemDefId.toString();
                previousTotals.set(defId, (previousTotals.get(defId) || 0) + item.quantity);
            }
        });

        // Find net gains and trigger notifications
        currentTotals.forEach((currentQty, defIdStr) => {
            const prevQty = previousTotals.get(defIdStr) || 0;
            const netChange = currentQty - prevQty;

            if (netChange > 0) {
                // Ensure itemDefId is valid before trying to parse and use it
                const itemDef = itemDefinitions.get(defIdStr);
                if (itemDef) {
                    addAcquisitionNotification(itemDef.id, netChange);
                } else {
                    console.warn(`[PlayerUI] Notification: Item definition not found for ID ${defIdStr} during net change calculation.`);
                }
            }
        });

        // Update the ref to the current snapshot for the next render/change detection
        prevInventoryRef.current = currentInventorySnapshot;

        // Note: The onInsert and onUpdate handlers for inventoryItem are no longer responsible
        // for triggering acquisition notifications directly. If they are still needed for other
        // side effects, they can be kept, otherwise they could be removed or simplified.
        // For this specific bug fix, we are moving the notification logic out of them.

        // Example: If you had specific logic in onInsert/onUpdate beyond notifications,
        // that would remain or be handled separately.
        // For now, we assume their primary role for *acquisition notifications* is superseded.

    }, [inventoryItems, identity, itemDefinitions, connection, addAcquisitionNotification]); // Added connection to deps
    // --- END REVISED EFFECT ---

    // Effect for inventory toggle keybind
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                // Toggle the inventory state
                onToggleInventory();
                // If closing, also clear the interaction target
                if (showInventory) {
                     onSetInteractingWith(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showInventory, onToggleInventory, onSetInteractingWith]);

    // Effect to disable background scrolling when inventory is open
    useEffect(() => {
        const preventBackgroundScroll = (event: WheelEvent) => {
            const target = event.target as Element;

            const inventoryPanel = document.querySelector('.inventoryPanel');

            if (!inventoryPanel || !showInventory) return;

            if (!inventoryPanel.contains(target)) {
                event.preventDefault();
                return;
            }

            // Check if the scroll event originated within a designated scrollable child
            const scrollableCrafting = target.closest('.craftableItemsSection');
            const scrollableQueue = target.closest('.craftingQueueList');
            // If you add more scrollable areas inside InventoryUI, add their selectors here:
            // const anotherScrollableArea = target.closest('.another-scrollable-class');

            if (scrollableCrafting || scrollableQueue /* || anotherScrollableArea */) {
                // If the event is within a known scrollable area, allow the default scroll behavior for that element.
                return;
            }

            // If the event is inside the inventory panel but not within a designated scrollable child,
            // prevent the default action to stop the main page from scrolling.
            event.preventDefault();
        };

        if (showInventory) {
            // Add the listener to the window
            window.addEventListener('wheel', preventBackgroundScroll, { passive: false });
            document.body.style.overflow = 'hidden'; // Hide body scrollbar
        } else {
            // Clean up listener and body style
            window.removeEventListener('wheel', preventBackgroundScroll);
            document.body.style.overflow = 'auto';
        }

        // Cleanup function
        return () => {
            window.removeEventListener('wheel', preventBackgroundScroll);
            document.body.style.overflow = 'auto';
        };
    }, [showInventory]);

    // --- Open Inventory when Interaction Starts --- 
    useEffect(() => {
        if (interactingWith) {
            if (!showInventory) {
                onToggleInventory();
            }
        }
    }, [interactingWith, showInventory, onToggleInventory]);

    // --- Handle Closing Inventory & Interaction --- 
    const handleClose = () => {
        if (showInventory) {
            onToggleInventory();
        }
        onSetInteractingWith(null); // Clear interaction state when closing
    };

    if (!localPlayer) {
        return null;
    }

    // --- Render without DndContext/Overlay ---
    return (
      // <DndContext...> // Remove wrapper
        <>
            {/* Sign Out Button - Fixed Top Right */}
            <button
                onClick={logout}
                style={{
                    position: 'fixed',
                    top: '15px',
                    right: '15px',
                    zIndex: 200,
                    background: '#444',
                    color: 'white',
                    border: '1px solid #888',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    fontFamily: '"Press Start 2P", cursive',
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0px rgba(0,0,0,0.5)',
                }}
            >
                Sign Out
            </button>
            {/* --- NEW: Render Item Acquisition Notifications --- */}
            <ItemAcquisitionNotificationUI notifications={acquisitionNotifications.slice(-MAX_NOTIFICATIONS_DISPLAYED)} />
            {/* --- END NEW --- */}

            {/* Status Bars UI */}
            <div style={{
                position: 'fixed',
                bottom: '15px',
                right: '15px',
                backgroundColor: 'rgba(40, 40, 60, 0.85)',
                color: 'white',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #a0a0c0',
                fontFamily: '"Press Start 2P", cursive',
                minWidth: '200px',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.5)',
                zIndex: 50, // Keep below inventory/overlay
            }}>
                {/* Status Bars mapping */}
                <StatusBar 
                    label="HP" 
                    icon="❤️" 
                    value={localPlayer.health} 
                    maxValue={100} 
                    barColor="#ff4040" 
                    hasActiveEffect={isHealthHealingOverTime}
                    hasBleedEffect={isPlayerBleeding}
                    pendingHealAmount={pendingBandageHealAmount}
                    glow={localPlayer.health < lowNeedThreshold}
                />
                <StatusBar label="SP" icon="⚡" value={localPlayer.stamina} maxValue={100} barColor="#40ff40" />
                {/*
                  Glow/pulse effect for Thirst, Hunger, Warmth when below LOW_NEED_THRESHOLD (20.0),
                  matching server logic for stat penalties/health loss. This helps players realize
                  why they're thirsty/hungry/cold and should take action soon.
                */}
                <StatusBar label="Thirst" icon="💧" value={localPlayer.thirst} maxValue={100} barColor="#40a0ff" glow={localPlayer.thirst < lowNeedThreshold} />
                <StatusBar label="Hunger" icon="🍖" value={localPlayer.hunger} maxValue={100} barColor="#ffa040" glow={localPlayer.hunger < lowNeedThreshold} />
                <StatusBar label="Warmth" icon="🔥" value={localPlayer.warmth} maxValue={100} barColor="#ffcc00" glow={localPlayer.warmth < lowNeedThreshold} />
            </div>

            {/* Render Inventory UI conditionally - Pass props down */}
            {showInventory && (
                <InventoryUI
                    playerIdentity={identity}
                    onClose={handleClose}
                    inventoryItems={inventoryItems}
                    itemDefinitions={itemDefinitions}
                    connection={connection}
                    activeEquipments={activeEquipments}
                    onItemDragStart={onItemDragStart}
                    onItemDrop={onItemDrop}
                    draggedItemInfo={draggedItemInfo}
                    interactionTarget={interactingWith}
                    campfires={campfires}
                    woodenStorageBoxes={woodenStorageBoxes}
                    playerCorpses={playerCorpses}
                    stashes={stashes}
                    startPlacement={startPlacement}
                    cancelPlacement={cancelPlacement}
                    placementInfo={placementInfo}
                    currentStorageBox={currentStorageBox}
                    recipes={recipes}
                    craftingQueueItems={craftingQueueItems}
                    onCraftingSearchFocusChange={onCraftingSearchFocusChange}
                 />
             )}

            {/* Hotbar Area */}
            {!placementInfo && (
                <Hotbar
                    playerIdentity={identity}
                    localPlayer={localPlayer}
                    itemDefinitions={itemDefinitions}
                    inventoryItems={inventoryItems}
                    connection={connection}
                    onItemDragStart={onItemDragStart}
                    onItemDrop={onItemDrop}
                    draggedItemInfo={draggedItemInfo}
                    interactingWith={interactingWith}
                    campfires={campfires}
                    stashes={stashes}
                    startPlacement={startPlacement}
                    cancelPlacement={cancelPlacement}
                />
            )}

            {/* Drag Overlay is removed - ghost handled by DraggableItem */}
       </>
      // </DndContext...> // Remove wrapper
    );
};

export default React.memo(PlayerUI);
