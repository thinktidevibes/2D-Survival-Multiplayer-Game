/**
 * GameScreen.tsx
 * 
 * Renders the main game view after the player has successfully logged in.
 * Composes the core game UI components:
 *  - `GameCanvas`: Renders the game world, players, entities.
 *  - `PlayerUI`: Renders inventory, equipment, crafting, container UIs.
 *  - `Hotbar`: Renders the player's quick-access item slots.
 *  - `DayNightCycleTracker`: Displays the current time of day visually.
 * Receives all necessary game state and action handlers as props from `App.tsx` 
 * and passes them down to the relevant child components.
 */

// Import child components
import GameCanvas from './GameCanvas';
import PlayerUI from './PlayerUI';
import Hotbar from './Hotbar';
import DayNightCycleTracker from './DayNightCycleTracker';
import Chat from './Chat';
import SpeechBubbleManager from './SpeechBubbleManager';

// Import types used by props
import { 
    Player as SpacetimeDBPlayer,
    Tree as SpacetimeDBTree,
    Stone as SpacetimeDBStone,
    Campfire as SpacetimeDBCampfire,
    Mushroom as SpacetimeDBMushroom,
    Hemp as SpacetimeDBHemp,
    Corn as SpacetimeDBCorn,
    Pumpkin as SpacetimeDBPumpkin,
    DroppedItem as SpacetimeDBDroppedItem,
    WoodenStorageBox as SpacetimeDBWoodenStorageBox,
    InventoryItem as SpacetimeDBInventoryItem,
    ItemDefinition as SpacetimeDBItemDefinition,
    WorldState as SpacetimeDBWorldState,
    ActiveEquipment as SpacetimeDBActiveEquipment,
    Recipe as SpacetimeDBRecipe,
    CraftingQueueItem as SpacetimeDBCraftingQueueItem,
    DbConnection,
    Message as SpacetimeDBMessage,
    PlayerPin,
    ActiveConnection,
    SleepingBag as SpacetimeDBSleepingBag,
    PlayerCorpse as SpacetimeDBPlayerCorpse,
    Stash as SpacetimeDBStash,
    ActiveConsumableEffect as SpacetimeDBActiveConsumableEffect,
    Cloud as SpacetimeDBCloud
} from '../generated';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { PlacementItemInfo, PlacementActions } from '../hooks/usePlacementManager';
import { InteractionTarget } from '../hooks/useInteractionManager';
import { DraggedItemInfo } from '../types/dragDropTypes';

// Import useSpeechBubbleManager hook
import { useSpeechBubbleManager } from '../hooks/useSpeechBubbleManager';

// Import other necessary imports
import { useInteractionManager } from '../hooks/useInteractionManager';
import { useState, useEffect } from 'react';

// Define props required by GameScreen and its children
interface GameScreenProps {
    // Core Game State (from useSpacetimeTables)
    players: Map<string, SpacetimeDBPlayer>;
    trees: Map<string, SpacetimeDBTree>;
    clouds: Map<string, SpacetimeDBCloud>;
    stones: Map<string, SpacetimeDBStone>;
    campfires: Map<string, SpacetimeDBCampfire>;
    mushrooms: Map<string, SpacetimeDBMushroom>;
    hemps: Map<string, SpacetimeDBHemp>;
    corns: Map<string, SpacetimeDBCorn>;
    pumpkins: Map<string, SpacetimeDBPumpkin>;
    droppedItems: Map<string, SpacetimeDBDroppedItem>;
    woodenStorageBoxes: Map<string, SpacetimeDBWoodenStorageBox>;
    sleepingBags: Map<string, SpacetimeDBSleepingBag>;
    playerPins: Map<string, PlayerPin>;
    playerCorpses: Map<string, SpacetimeDBPlayerCorpse>;
    stashes: Map<string, SpacetimeDBStash>;
    inventoryItems: Map<string, SpacetimeDBInventoryItem>;
    itemDefinitions: Map<string, SpacetimeDBItemDefinition>;
    worldState: SpacetimeDBWorldState | null;
    activeEquipments: Map<string, SpacetimeDBActiveEquipment>;
    recipes: Map<string, SpacetimeDBRecipe>;
    craftingQueueItems: Map<string, SpacetimeDBCraftingQueueItem>;
    messages: Map<string, SpacetimeDBMessage>;
    activeConnections: Map<string, ActiveConnection> | undefined;
    activeConsumableEffects: Map<string, SpacetimeDBActiveConsumableEffect>;
    
    // Connection & Player Info
    localPlayerId?: string;
    playerIdentity: Identity | null;
    connection: DbConnection | null;
    
    // Placement State/Actions (from usePlacementManager)
    placementInfo: PlacementItemInfo | null;
    placementActions: PlacementActions; // Pass whole object if GameCanvas needs more than cancel
    placementError: string | null;
    startPlacement: (itemInfo: PlacementItemInfo) => void;
    cancelPlacement: () => void;

    // Interaction Handler (from useInteractionManager)
    interactingWith: InteractionTarget;
    handleSetInteractingWith: (target: InteractionTarget) => void;

    // Drag/Drop Handlers (from useDragDropManager)
    draggedItemInfo: DraggedItemInfo | null;
    onItemDragStart: (info: DraggedItemInfo) => void;
    onItemDrop: (targetSlotInfo: any | null) => void; // Use appropriate type if known

    // Reducer Actions (from usePlayerActions)
    updatePlayerPosition: (moveX: number, moveY: number) => void;
    callJumpReducer: () => void;
    callSetSprintingReducer: (isSprinting: boolean) => void;
    isMinimapOpen: boolean;
    setIsMinimapOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isChatting: boolean;
    setIsChatting: (isChatting: boolean) => void;
}

const GameScreen: React.FC<GameScreenProps> = (props) => {
    // ADD THIS LOG AT THE VERY BEGINNING OF THE COMPONENT
    // console.log("[GameScreen.tsx] Received props including activeConsumableEffects:", props.activeConsumableEffects);
    const [showInventoryState, setShowInventoryState] = useState(false);

    // Destructure props for cleaner usage
    const {
        players, trees, stones, campfires, mushrooms, corns, pumpkins, hemps, droppedItems, woodenStorageBoxes, sleepingBags,
        playerPins, playerCorpses, stashes,
        inventoryItems, itemDefinitions, worldState, activeEquipments, recipes, craftingQueueItems,
        messages,
        activeConnections,
        localPlayerId, playerIdentity, connection,
        placementInfo, placementActions, placementError, startPlacement, cancelPlacement,
        interactingWith, handleSetInteractingWith,
        draggedItemInfo, onItemDragStart, onItemDrop,
        updatePlayerPosition, callJumpReducer: jump, callSetSprintingReducer: setSprinting,
        isMinimapOpen,
        setIsMinimapOpen,
        isChatting,
        setIsChatting,
        activeConsumableEffects,
        clouds,
    } = props;

    // You can also add a useEffect here if the above doesn't show up
    useEffect(() => {
        // console.log("[GameScreen.tsx] activeConsumableEffects prop after destructuring:", activeConsumableEffects);
    }, [activeConsumableEffects]);

    // Find local player for viewport calculations
    const localPlayer = localPlayerId ? players.get(localPlayerId) : undefined;
    
    // Use our custom hook to get camera offsets
    const { cameraOffsetX, cameraOffsetY } = useSpeechBubbleManager(localPlayer);

    // Added state
    const [isCraftingSearchFocused, setIsCraftingSearchFocused] = useState(false);

    return (
        <div className="game-container">
            <GameCanvas
                players={players}
                trees={trees}
                clouds={clouds}
                stones={stones}
                campfires={campfires}
                mushrooms={mushrooms}
                hemps={hemps}
                corns={corns}
                pumpkins={pumpkins}
                droppedItems={droppedItems}
                woodenStorageBoxes={woodenStorageBoxes}
                sleepingBags={sleepingBags}
                playerPins={playerPins}
                playerCorpses={playerCorpses}
                stashes={stashes}
                inventoryItems={inventoryItems}
                itemDefinitions={itemDefinitions}
                worldState={worldState}
                activeEquipments={activeEquipments}
                activeConnections={activeConnections}
                localPlayerId={localPlayerId}
                connection={connection}
                placementInfo={placementInfo}
                placementActions={placementActions}
                placementError={placementError}
                onSetInteractingWith={handleSetInteractingWith}
                updatePlayerPosition={updatePlayerPosition}
                callJumpReducer={jump}
                callSetSprintingReducer={setSprinting}
                isMinimapOpen={isMinimapOpen}
                setIsMinimapOpen={setIsMinimapOpen}
                isChatting={isChatting}
                messages={messages}
                isSearchingCraftRecipes={isCraftingSearchFocused}
                activeConsumableEffects={activeConsumableEffects}
                showInventory={showInventoryState}
            />
            
            {/* Use our camera offsets for SpeechBubbleManager */}
            <SpeechBubbleManager
                messages={messages}
                players={players}
                cameraOffsetX={cameraOffsetX}
                cameraOffsetY={cameraOffsetY}
                localPlayerId={localPlayerId}
            />
            
            <PlayerUI
                identity={playerIdentity}
                players={players}
                inventoryItems={inventoryItems}
                itemDefinitions={itemDefinitions}
                recipes={recipes}
                craftingQueueItems={craftingQueueItems}
                onItemDragStart={onItemDragStart}
                onItemDrop={onItemDrop}
                draggedItemInfo={draggedItemInfo}
                interactingWith={interactingWith}
                onSetInteractingWith={handleSetInteractingWith}
                campfires={campfires}
                woodenStorageBoxes={woodenStorageBoxes}
                playerCorpses={playerCorpses}
                stashes={stashes}
                currentStorageBox={
                    interactingWith?.type === 'wooden_storage_box'
                        ? woodenStorageBoxes.get(interactingWith.id.toString()) || null
                        : null
                }
                startPlacement={startPlacement}
                cancelPlacement={cancelPlacement}
                placementInfo={placementInfo}
                connection={connection}
                activeEquipments={activeEquipments}
                activeConsumableEffects={activeConsumableEffects}
                onCraftingSearchFocusChange={setIsCraftingSearchFocused}
                onToggleInventory={() => setShowInventoryState(prev => !prev)}
                showInventory={showInventoryState}
            />
            <Hotbar
                playerIdentity={playerIdentity}
                localPlayer={localPlayer || null}
                itemDefinitions={itemDefinitions}
                inventoryItems={inventoryItems}
                onItemDragStart={onItemDragStart}
                onItemDrop={onItemDrop}
                draggedItemInfo={draggedItemInfo}
                interactingWith={interactingWith}
                startPlacement={startPlacement}
                cancelPlacement={cancelPlacement}
                connection={connection}
                campfires={campfires}
                stashes={stashes}
            />
            <DayNightCycleTracker worldState={worldState} />
            <Chat 
                connection={connection}
                messages={messages} 
                players={players}
                isChatting={isChatting}
                setIsChatting={setIsChatting}
                localPlayerIdentity={localPlayerId}
            />
        </div>
    );
};

export default GameScreen; 