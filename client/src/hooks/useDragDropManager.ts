import { useState, useRef, useCallback, useEffect } from 'react';
import { DraggedItemInfo, DragSourceSlotInfo } from '../types/dragDropTypes';
import { DbConnection, InventoryItem } from '../generated'; // Import connection type and InventoryItem
import { Identity } from '@clockworklabs/spacetimedb-sdk'; // Ensure Identity is imported
// Import location data types if not already present
import { InventoryLocationData, HotbarLocationData } from '../generated'; 

// Props for the hook
interface UseDragDropManagerProps {
    connection: DbConnection | null;
    interactingWith: { type: string; id: number | bigint } | null;
    playerIdentity: Identity | null; // Added playerIdentity
}

// Return type of the hook
interface DragDropManager {
    draggedItemInfo: DraggedItemInfo | null;
    dropError: string | null; // Specific error from drop actions
    handleItemDragStart: (info: DraggedItemInfo) => void;
    handleItemDrop: (targetSlot: DragSourceSlotInfo | null) => void;
}

export const useDragDropManager = ({
    connection,
    interactingWith,
    playerIdentity, // Destructure playerIdentity
}: UseDragDropManagerProps): DragDropManager => {
    const [draggedItemInfo, setDraggedItemInfo] = useState<DraggedItemInfo | null>(null);
    const [dropError, setDropError] = useState<string | null>(null);
    // Ref to hold the latest dragged item info, accessible in callbacks
    const draggedItemRef = useRef<DraggedItemInfo | null>(null);

    // Keep ref updated whenever state changes
    useEffect(() => {
        draggedItemRef.current = draggedItemInfo;
    }, [draggedItemInfo]);

    const handleItemDragStart = useCallback((info: DraggedItemInfo) => {
        // console.log("[useDragDropManager] Drag Start:", info);
        setDraggedItemInfo(info);
        setDropError(null); // Clear previous errors on new drag
        document.body.classList.add('item-dragging');
    }, []);

    const handleItemDrop = useCallback((targetSlot: DragSourceSlotInfo | null) => {
        // console.log("[useDragDropManager] Drop Target:", targetSlot);
        document.body.classList.remove('item-dragging');
        const sourceInfo = draggedItemRef.current;

        // Always clear drag state
        draggedItemRef.current = null;
        setDraggedItemInfo(null);
        setDropError(null); // Clear previous errors on new drop attempt

        if (!sourceInfo) {
            // console.log("[useDragDropManager Drop] No source info found, ignoring drop.");
            return;
        }
        if (!connection?.reducers) {
            // console.log("[useDragDropManager Drop] No reducers connection, ignoring drop.");
            setDropError("Cannot perform action: Not connected to server.");
            return;
        }

        const itemInstanceId = BigInt(sourceInfo.item.instance.instanceId);

        // --- Handle Dropping Item into the World ---
        if (targetSlot === null) {
            const quantityToDrop = sourceInfo.splitQuantity ?? sourceInfo.item.instance.quantity;

            // Define handlers for specific container types
            const worldDropHandlers: Record<string, {
                validateAndGetEntityId: (rawId: any) => number | null;
                dropReducer: (entityId: number, slotIndex: number) => void;
                splitDropReducer: (entityId: number, slotIndex: number, quantity: number) => void;
                containerName: string; // For logging
            }> = {
                'wooden_storage_box': {
                    validateAndGetEntityId: (rawId) => (typeof rawId === 'number' ? rawId : null),
                    dropReducer: connection.reducers.dropItemFromBoxSlotToWorld.bind(connection.reducers),
                    splitDropReducer: connection.reducers.splitAndDropItemFromBoxSlotToWorld.bind(connection.reducers),
                    containerName: "Box"
                },
                'player_corpse': {
                    validateAndGetEntityId: (rawId) => (typeof rawId === 'bigint' ? Number(rawId) : null),
                    dropReducer: connection.reducers.dropItemFromCorpseSlotToWorld.bind(connection.reducers),
                    splitDropReducer: connection.reducers.splitAndDropItemFromCorpseSlotToWorld.bind(connection.reducers),
                    containerName: "Corpse"
                },
                'campfire_fuel': {
                    validateAndGetEntityId: (rawId) => (typeof rawId === 'number' ? rawId : null),
                    dropReducer: connection.reducers.dropItemFromCampfireSlotToWorld.bind(connection.reducers),
                    splitDropReducer: connection.reducers.splitAndDropItemFromCampfireSlotToWorld.bind(connection.reducers),
                    containerName: "Campfire"
                },
                'stash': { // New entry for stash world drop
                    validateAndGetEntityId: (rawId) => (typeof rawId === 'number' ? rawId : null),
                    dropReducer: connection.reducers.dropItemFromStashSlotToWorld.bind(connection.reducers),
                    splitDropReducer: connection.reducers.splitAndDropItemFromStashSlotToWorld.bind(connection.reducers),
                    containerName: "Stash"
                }
            };

            try {
                const handler = worldDropHandlers[sourceInfo.sourceContainerType || ''];
                
                if (handler) {
                    const rawEntityId = sourceInfo.sourceContainerEntityId;
                    const rawSlotIndex = sourceInfo.sourceSlot.index;
                    const entityIdNum = handler.validateAndGetEntityId(rawEntityId);

                    let numericSlotIndex: number | null = null;
                    if (typeof rawSlotIndex === 'number') {
                        numericSlotIndex = rawSlotIndex;
                    } else if (typeof rawSlotIndex === 'string') {
                        numericSlotIndex = parseInt(rawSlotIndex, 10);
                        if (isNaN(numericSlotIndex)) {
                            numericSlotIndex = null; // Parsing failed
                        }
                    }

                    if (entityIdNum !== null && numericSlotIndex !== null) {
                        if (sourceInfo.splitQuantity) {
                            console.log(`[useDragDropManager Drop] Calling split_and_drop_item_from_${handler.containerName.toLowerCase()}_slot_to_world. ${handler.containerName}ID: ${entityIdNum}, Slot: ${numericSlotIndex}, Qty: ${quantityToDrop}`);
                            if (handler.splitDropReducer) {
                                handler.splitDropReducer(entityIdNum, numericSlotIndex, quantityToDrop);
                            } else {
                                console.error(`[useDragDropManager Drop] splitDropReducer is undefined for ${handler.containerName}`);
                                setDropError(`Configuration error: Split drop action not found for ${handler.containerName.toLowerCase()}.`);
                            }
                        } else {
                            console.log(`[useDragDropManager Drop] Calling drop_item_from_${handler.containerName.toLowerCase()}_slot_to_world. ${handler.containerName}ID: ${entityIdNum}, Slot: ${numericSlotIndex}`);
                            if (handler.dropReducer) {
                                handler.dropReducer(entityIdNum, numericSlotIndex);
                            } else {
                                console.error(`[useDragDropManager Drop] dropReducer is undefined for ${handler.containerName}`);
                                setDropError(`Configuration error: Drop action not found for ${handler.containerName.toLowerCase()}.`);
                            }
                        }
                    } else {
                        console.error(`[useDragDropManager Drop] Invalid entityId (ID: ${rawEntityId}) or slotIndex (Raw: ${rawSlotIndex}, Parsed: ${numericSlotIndex}) for ${handler.containerName}.`);
                        setDropError(`Cannot drop item: Invalid container ID or slot index for ${handler.containerName.toLowerCase()}.`);
                    }
                } else { 
                    // Default to player inventory drop if sourceContainerType is not in handlers
                    // (e.g., 'inventory', 'hotbar', 'equipment')
                    console.log(`[useDragDropManager Drop] Calling drop_item (default/player inventory). Item: ${itemInstanceId}, Qty: ${quantityToDrop}`);
                    connection.reducers.dropItem(itemInstanceId, quantityToDrop);
                }
            } catch (error) {
                console.error(`[useDragDropManager Drop] Error calling drop reducer (Source: ${sourceInfo.sourceContainerType}):`, error);
                setDropError(`Failed to drop item: ${(error as any)?.message || error}`);
            }
            return; // Drop handled, exit
        }

        // --- Proceed with logic for dropping onto a slot ---
        // console.log(`[useDragDropManager Drop] Processing drop onto slot: Item ${itemInstanceId} from ${sourceInfo.sourceSlot.type}:${sourceInfo.sourceSlot.index} to ${targetSlot.type}:${targetSlot.index}`);

        try {
            // --- Handle Stack Splitting First ---
            if (sourceInfo.splitQuantity && sourceInfo.splitQuantity > 0) {
                const quantityToSplit = sourceInfo.splitQuantity;
                const sourceSlotType = sourceInfo.sourceSlot.type;
                const targetSlotType = targetSlot.type;
                const sourceInstanceId = BigInt(sourceInfo.item.instance.instanceId);

                // console.log(`[useDragDropManager Drop] Initiating SPLIT: Qty ${quantityToSplit} from ${sourceSlotType}:${sourceInfo.sourceSlot.index} to ${targetSlotType}:${targetSlot.index}`);

                // --- Split Logic ---
                if (sourceSlotType === 'inventory' || sourceSlotType === 'hotbar') {
                    let targetSlotIndexNum: number | null = null;
                    let targetContainerIdNum: number | null = null;

                    if (targetSlotType as string === 'inventory' || targetSlotType as string === 'hotbar') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        if (isNaN(targetSlotIndexNum)) { setDropError("Invalid target slot index."); return; }

                        // START MODIFICATION: Check if target slot is occupied by a different item type
                        let targetItemInstance: InventoryItem | undefined = undefined;
                        if (connection && playerIdentity) {
                            const allPlayerItems = Array.from(connection.db.inventoryItem.iter());
                            if (targetSlotType === 'inventory') {
                                targetItemInstance = allPlayerItems.find(i =>
                                    i.location.tag === 'Inventory' &&
                                    i.location.value instanceof Object && 'ownerId' in i.location.value && 'slotIndex' in i.location.value && // Type guard
                                    (i.location.value as InventoryLocationData).ownerId.isEqual(playerIdentity) &&
                                    (i.location.value as InventoryLocationData).slotIndex === targetSlotIndexNum
                                );
                            } else { // hotbar
                                targetItemInstance = allPlayerItems.find(i =>
                                    i.location.tag === 'Hotbar' &&
                                    i.location.value instanceof Object && 'ownerId' in i.location.value && 'slotIndex' in i.location.value && // Type guard
                                    (i.location.value as HotbarLocationData).ownerId.isEqual(playerIdentity) &&
                                    (i.location.value as HotbarLocationData).slotIndex === targetSlotIndexNum
                                );
                            }
                        }

                        if (targetItemInstance && sourceInfo.item.definition.id !== targetItemInstance.itemDefId) {
                            // console.log(`[useDragDropManager Drop Split] Prevented split: Source item def ID '${sourceInfo.item.definition.id}' differs from target item def ID '${targetItemInstance.itemDefId}'.`);
                            // setDropError("Cannot stack different item types."); 
                            return; 
                        }
                        // END MODIFICATION

                        // console.log(`[useDragDropManager Drop Split] Calling splitStack (Inv/Hotbar -> Inv/Hotbar)`);
                        connection.reducers.splitStack(sourceInstanceId, quantityToSplit, targetSlotType, targetSlotIndexNum);
                    } else if (targetSlotType === 'campfire_fuel') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        targetContainerIdNum = targetSlot.parentId ? Number(targetSlot.parentId) : null;
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum) || targetContainerIdNum === null || isNaN(targetContainerIdNum)) {
                            console.error("[useDragDropManager Drop] Split failed: Invalid target index or missing CampfireID.");
                            setDropError("Invalid target slot or context for campfire split.");
                            return;
                        }
                        // console.log(`[useDragDropManager Drop Split] Calling split_stack_into_campfire`);
                        connection.reducers.splitStackIntoCampfire(sourceInstanceId, quantityToSplit, targetContainerIdNum, targetSlotIndexNum);
                    } else if (targetSlotType === 'wooden_storage_box') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        targetContainerIdNum = targetSlot.parentId ? Number(targetSlot.parentId) : null;
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum) || targetContainerIdNum === null || isNaN(targetContainerIdNum)) {
                            console.error("[useDragDropManager Drop] Split failed: Invalid target index or missing BoxID.");
                            setDropError("Invalid target slot or context for box split.");
                            return;
                        }
                        // console.log(`[useDragDropManager Drop Split] Calling split_stack_into_box`);
                        connection.reducers.splitStackIntoBox(targetContainerIdNum, targetSlotIndexNum, sourceInstanceId, quantityToSplit);
                    } else if (targetSlotType === 'player_corpse') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        const targetContainerIdBigInt = targetSlot.parentId ? BigInt(targetSlot.parentId) : null;
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum) || targetContainerIdBigInt === null) {
                            console.error("[useDragDropManager Drop] Split failed: Invalid target index or missing CorpseID.");
                            setDropError("Invalid target slot or context for corpse split.");
                            return;
                        }
                        const targetCorpseIdU32 = Number(targetContainerIdBigInt); // Convert BigInt to number (u32 for reducer)
                        console.log(`[useDragDropManager Drop Split] Calling split_stack_into_corpse (Corpse ${targetCorpseIdU32}, Slot ${targetSlotIndexNum})`);
                        connection.reducers.splitStackIntoCorpse(targetCorpseIdU32, targetSlotIndexNum, sourceInstanceId, quantityToSplit);
                    } else if (targetSlotType === 'stash') { // Splitting into Stash
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        targetContainerIdNum = targetSlot.parentId ? Number(targetSlot.parentId) : null; // Stash ID
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum) || targetContainerIdNum === null || isNaN(targetContainerIdNum)) {
                            console.error("[useDragDropManager Drop] Split failed: Invalid target index or missing StashID.");
                            setDropError("Invalid target slot or context for stash split.");
                            return;
                        }
                        console.log(`[useDragDropManager Drop Split] Calling split_stack_into_stash (StashID: ${targetContainerIdNum}, Slot: ${targetSlotIndexNum}, Item: ${sourceInstanceId}, Qty: ${quantityToSplit})`);
                        connection.reducers.splitStackIntoStash(targetContainerIdNum, targetSlotIndexNum, sourceInstanceId, quantityToSplit);
                    } else {
                        console.warn(`[useDragDropManager Drop] Split ignored: Cannot split from ${sourceSlotType} to ${targetSlotType}`);
                        setDropError("Cannot split item to that location.");
                    }
                } else if (sourceSlotType === 'campfire_fuel') {
                    const sourceCampfireId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceCampfireId === null || isNaN(sourceIndexNum)) {
                        console.error("[useDragDropManager Drop] Missing CampfireID or SourceIndex for split FROM campfire");
                        setDropError("Could not determine source campfire slot for split.");
                        return;
                    }
                    let targetSlotIndexNum: number | null = null;
                    if (targetSlotType as string === 'inventory' || targetSlotType as string === 'hotbar') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum)) {
                            console.error("[useDragDropManager Drop] Invalid target index number for split from campfire.");
                            setDropError("Invalid target slot for split.");
                            return;
                        }

                        // --- DEBUG LOGS START ---
                        console.log(`[DEBUG] Splitting from Campfire (${sourceCampfireId}, Slot ${sourceIndexNum})`);
                        console.log(`  Source Item:`, sourceInfo.item);
                        console.log(`  Quantity to Split: ${quantityToSplit}`);
                        console.log(`  Target Slot: ${targetSlotType}:${targetSlotIndexNum}`);

                        // Check target slot state BEFORE calling reducer
                        let targetItemInstance: InventoryItem | undefined = undefined;
                        if (connection && playerIdentity) { // Ensure connection and playerIdentity exist
                            const allPlayerItems = Array.from(connection.db.inventoryItem.iter()); 
                            if (targetSlotType === 'inventory') {
                                targetItemInstance = allPlayerItems.find(i => 
                                    i.location.tag === 'Inventory' &&
                                    (i.location.value as InventoryLocationData).ownerId.isEqual(playerIdentity) &&
                                    (i.location.value as InventoryLocationData).slotIndex === targetSlotIndexNum
                                );
                            } else { // hotbar
                                targetItemInstance = allPlayerItems.find(i => 
                                    i.location.tag === 'Hotbar' &&
                                    (i.location.value as HotbarLocationData).ownerId.isEqual(playerIdentity) &&
                                    (i.location.value as HotbarLocationData).slotIndex === targetSlotIndexNum
                                );
                            }
                        }
                        if (targetItemInstance) {
                            console.log(`  Target Slot Occupied By:`, targetItemInstance);
                            console.log(`    -> Current Quantity: ${targetItemInstance.quantity}`);
                        } else {
                            console.log(`  Target Slot is Empty.`);
                        }
                        console.log(`  Calling Reducer: splitStackFromCampfire(${sourceCampfireId}, ${sourceIndexNum}, ${quantityToSplit}, ${targetSlotType}, ${targetSlotIndexNum})`);
                        // --- DEBUG LOGS END ---
                        
                        connection.reducers.splitStackFromCampfire(
                            sourceCampfireId,
                            sourceIndexNum,
                            quantityToSplit,
                            targetSlotType,
                            targetSlotIndexNum
                        );
                    } else if (targetSlotType === 'campfire_fuel') {
                        // Handle splitting within the same campfire
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        const targetCampfireId = targetSlot.parentId ? Number(targetSlot.parentId) : null;
                        
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum) || targetCampfireId === null || isNaN(targetCampfireId)) {
                            console.error("[useDragDropManager Drop] Invalid target index or missing CampfireID for intra-campfire split.");
                            setDropError("Invalid target slot for campfire split.");
                            return;
                        }
                        
                        if (sourceCampfireId !== targetCampfireId) {
                            console.warn("[useDragDropManager Drop] Cannot split between different campfires yet.");
                            setDropError("Cannot split between different campfires.");
                            return;
                        }
                        
                        console.log(`[useDragDropManager Drop] Calling split_stack_within_campfire: Campfire ${sourceCampfireId} from slot ${sourceIndexNum} to slot ${targetSlotIndexNum}, amount: ${quantityToSplit}`);
                        connection.reducers.splitStackWithinCampfire(
                            sourceCampfireId,
                            sourceIndexNum,
                            quantityToSplit,
                            targetSlotIndexNum
                        );
                    } else {
                        console.warn(`[useDragDropManager Drop] Split ignored: Cannot split from ${sourceSlotType} to ${targetSlotType}`);
                        setDropError("Cannot split item to that location.");
                        return;
                    }
                } else if (sourceSlotType === 'wooden_storage_box') {
                    const sourceBoxId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceBoxId === null || isNaN(sourceIndexNum)) {
                        console.error("[useDragDropManager Drop] Missing BoxID or SourceIndex for split FROM box");
                        setDropError("Could not determine source box slot for split.");
                        return;
                    }
                    let targetSlotIndexNum: number | null = null;
                    if (targetSlotType as string === 'inventory' || targetSlotType as string === 'hotbar') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum)) {
                            console.error("[useDragDropManager Drop] Invalid target index for split from box.");
                            setDropError("Invalid target slot for split.");
                            return;
                        }
                        // console.log(`[useDragDropManager Drop] Calling split_stack_from_box`);
                        connection.reducers.splitStackFromBox(sourceBoxId, sourceIndexNum, quantityToSplit, targetSlotType, targetSlotIndexNum);
                    } else if (targetSlotType === 'wooden_storage_box') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        const targetBoxIdNum = targetSlot.parentId ? Number(targetSlot.parentId) : null;
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum) || targetBoxIdNum === null || isNaN(targetBoxIdNum)) { setDropError("Invalid target box slot."); return; }
                        if (sourceBoxId !== targetBoxIdNum) {
                            setDropError("Cannot split between different boxes yet.");
                            return;
                        }
                        // console.log(`[useDragDropManager Drop Split] Calling split_stack_within_box`);
                        connection.reducers.splitStackWithinBox(sourceBoxId, sourceIndexNum, targetSlotIndexNum, quantityToSplit);
                    } else {
                        console.warn(`[useDragDropManager Drop] Split ignored: Cannot split from ${sourceSlotType} to ${targetSlotType}`);
                        setDropError("Cannot split item to that location.");
                    }
                } else if (sourceSlotType as string === 'player_corpse') {
                    // <<< Logic for splitting FROM a corpse slot >>>
                    const sourceCorpseIdBigInt = sourceInfo.sourceSlot.parentId ? BigInt(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);

                    if (sourceCorpseIdBigInt === null || isNaN(sourceIndexNum)) {
                        console.error("[useDragDropManager Drop] Missing CorpseID or SourceIndex for split FROM corpse");
                        setDropError("Could not determine source corpse slot for split.");
                        return;
                    }
                    const sourceCorpseIdU32 = Number(sourceCorpseIdBigInt); // Convert for reducer

                    // Case 1: Splitting FROM Corpse TO Player Inventory/Hotbar
                    if (targetSlotType as string === 'inventory' || targetSlotType as string === 'hotbar') {
                        const targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum)) {
                            console.error("[useDragDropManager Drop] Invalid target index for split from corpse.");
                            setDropError("Invalid target slot for split.");
                            return;
                        }
                        console.log(`[useDragDropManager Drop Split] Calling splitStackFromCorpse (Corpse ${sourceCorpseIdU32}, Slot ${sourceIndexNum} -> ${targetSlotType} ${targetSlotIndexNum})`);
                        connection.reducers.splitStackFromCorpse(
                            sourceCorpseIdU32,
                            sourceIndexNum,
                            quantityToSplit,
                            targetSlotType,
                            targetSlotIndexNum
                        );
                    // Case 2: Splitting FROM Corpse TO the SAME Corpse
                    } else if (targetSlotType === 'player_corpse') {
                        const targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        const targetCorpseIdBigInt = targetSlot.parentId ? BigInt(targetSlot.parentId) : null;

                        if (targetSlotIndexNum === null || isNaN(targetSlotIndexNum) || targetCorpseIdBigInt === null) {
                            console.error("[useDragDropManager Drop] Invalid target index or missing Target CorpseID for intra-corpse split.");
                            setDropError("Invalid target slot for corpse split.");
                            return;
                        }
                        // Ensure splitting within the SAME corpse
                        if (sourceCorpseIdBigInt !== targetCorpseIdBigInt) {
                            console.warn("[useDragDropManager Drop] Cannot split between different corpses yet.");
                            setDropError("Cannot split between different corpses.");
                            return;
                        }
                        console.log(`[useDragDropManager Drop Split] Calling splitStackWithinCorpse (Corpse ${sourceCorpseIdU32}, Slot ${sourceIndexNum} -> Slot ${targetSlotIndexNum})`);
                        connection.reducers.splitStackWithinCorpse(
                            sourceCorpseIdU32,
                            sourceIndexNum,
                            targetSlotIndexNum,
                            quantityToSplit
                        );
                    } else {
                        // Handle other invalid targets if needed (e.g., splitting corpse -> box)
                        console.warn(`[useDragDropManager Drop] Split ignored: Cannot split from ${sourceSlotType} to ${targetSlotType}`);
                        setDropError("Cannot split item to that location.");
                    }
                    return; // Split attempt from corpse handled
                } else if (sourceSlotType === 'stash') {
                    const sourceStashId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);

                    if (sourceStashId === null || isNaN(sourceIndexNum)) {
                        console.error("[useDragDropManager Drop] Missing StashID or SourceIndex for split FROM stash");
                        setDropError("Could not determine source stash slot for split.");
                        return;
                    }

                    let targetSlotIndexNum: number | null = null;
                    if (targetSlotType === 'inventory' || targetSlotType === 'hotbar') {
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                        if (isNaN(targetSlotIndexNum)) {
                            setDropError("Invalid target player slot index for split from stash.");
                            return;
                        }
                        console.log(`[useDragDropManager Drop Split] Calling split_stack_from_stash (StashID: ${sourceStashId}, StashSlot: ${sourceIndexNum}, Qty: ${quantityToSplit}, Target: ${targetSlotType}, TargetSlot: ${targetSlotIndexNum})`);
                        connection.reducers.splitStackFromStash(sourceStashId, sourceIndexNum, quantityToSplit, targetSlotType, targetSlotIndexNum);

                    } else if (targetSlotType === 'stash') {
                        const targetStashId = targetSlot.parentId ? Number(targetSlot.parentId) : null;
                        targetSlotIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);

                        if (targetStashId === null || isNaN(targetSlotIndexNum)) {
                            console.error("[useDragDropManager Drop] Invalid target stash slot index or missing StashID for split within stash.");
                            setDropError("Invalid target stash slot for split.");
                            return;
                        }
                        if (sourceStashId !== targetStashId) {
                            console.warn("[useDragDropManager Drop] Split ignored: Cannot split between different stashes this way.");
                            setDropError("Cannot split item to a different stash container directly.");
                            return;
                        }
                        // console.log(`[useDragDropManager Drop Split] Calling splitItemWithinStash (StashID: ${sourceStashId}, FromSlot: ${sourceIndexNum}, ToSlot: ${targetSlotIndexNum}, Qty: ${quantityToSplit})`);
                        connection.reducers.splitStackWithinStash(sourceStashId, sourceIndexNum, targetSlotIndexNum, quantityToSplit);
                    } else {
                        console.warn(`[useDragDropManager Drop] Split ignored: Cannot split from ${sourceSlotType} to ${targetSlotType}`);
                        setDropError("Cannot split item to that location from a stash.");
                    }
                } else {
                    console.warn(`[useDragDropManager Drop] Split ignored: Cannot split from source type ${sourceSlotType}`);
                    setDropError("Cannot split from this item source.");
                }
                return; // Split attempt handled
            }

            // --- Standard Item Move (Full Stack) ---
            if (targetSlot.type === 'inventory') {
                const targetIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                if (isNaN(targetIndexNum)) { console.error("Invalid inventory index", targetSlot.index); setDropError("Invalid slot."); return; }
                if (sourceInfo.sourceSlot.type === 'campfire_fuel') {
                    const sourceCampfireId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceCampfireId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing CampfireID/SourceIndex"); setDropError("Cannot move item: Source context lost."); return; }
                    // console.log(`[useDragDropManager Drop] Calling moveFuelItemToPlayerSlot (to inventory)`);
                    connection.reducers.moveFuelItemToPlayerSlot(sourceCampfireId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else if (sourceInfo.sourceSlot.type === 'wooden_storage_box') {
                    const sourceBoxId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceBoxId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing BoxID/SourceIndex"); setDropError("Cannot move item: Source context lost."); return; }
                    // console.log(`[useDragDropManager Drop] Calling move_item_from_box (to inventory)`);
                    connection.reducers.moveItemFromBox(sourceBoxId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else if (sourceInfo.sourceSlot.type === 'player_corpse') {
                    const sourceCorpseId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceCorpseId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing CorpseID/SourceIndex"); setDropError("Cannot move item: Source context lost."); return; }
                    connection.reducers.moveItemFromCorpse(sourceCorpseId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else if (sourceInfo.sourceSlot.type === 'stash') { // Moving FROM stash TO inventory
                    const sourceStashId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceStashId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing StashID/SourceIndex for move from stash"); setDropError("Cannot move item: Source context lost."); return; }
                    console.log(`[useDragDropManager Drop] Calling move_item_from_stash (StashID: ${sourceStashId}, Slot: ${sourceIndexNum} to inventory ${targetIndexNum})`);
                    connection.reducers.moveItemFromStash(sourceStashId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else {
                    // Default move to inventory (from inv/hotbar/equip)
                    connection.reducers.moveItemToInventory(itemInstanceId, targetIndexNum);
                }
            } else if (targetSlot.type === 'hotbar') {
                const targetIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                if (isNaN(targetIndexNum)) { console.error("Invalid hotbar index", targetSlot.index); setDropError("Invalid slot."); return; }
                if (sourceInfo.sourceSlot.type === 'campfire_fuel') {
                    const sourceCampfireId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceCampfireId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing CampfireID/SourceIndex"); setDropError("Cannot move item: Source context lost."); return; }
                    // console.log(`[useDragDropManager Drop] Calling moveFuelItemToPlayerSlot (to hotbar)`);
                    connection.reducers.moveFuelItemToPlayerSlot(sourceCampfireId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else if (sourceInfo.sourceSlot.type === 'wooden_storage_box') {
                    const sourceBoxId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceBoxId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing BoxID/SourceIndex"); setDropError("Cannot move item: Source context lost."); return; }
                    // console.log(`[useDragDropManager Drop] Calling move_item_from_box (to hotbar)`);
                    connection.reducers.moveItemFromBox(sourceBoxId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else if (sourceInfo.sourceSlot.type === 'player_corpse') {
                    const sourceCorpseId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceCorpseId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing CorpseID/SourceIndex"); setDropError("Cannot move item: Source context lost."); return; }
                    connection.reducers.moveItemFromCorpse(sourceCorpseId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else if (sourceInfo.sourceSlot.type === 'stash') { // Moving FROM stash TO hotbar
                    const sourceStashId = sourceInfo.sourceSlot.parentId ? Number(sourceInfo.sourceSlot.parentId) : null;
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (sourceStashId === null || isNaN(sourceIndexNum)) { console.error("[useDragDropManager Drop] Missing StashID/SourceIndex for move from stash"); setDropError("Cannot move item: Source context lost."); return; }
                    console.log(`[useDragDropManager Drop] Calling move_item_from_stash (StashID: ${sourceStashId}, Slot: ${sourceIndexNum} to hotbar ${targetIndexNum})`);
                    connection.reducers.moveItemFromStash(sourceStashId, sourceIndexNum, targetSlot.type, targetIndexNum);
                } else {
                    // Default move to hotbar (from inv/hotbar/equip)
                    connection.reducers.moveItemToHotbar(itemInstanceId, targetIndexNum);
                }
            } else if (targetSlot.type === 'equipment' && typeof targetSlot.index === 'string') {
                connection.reducers.equipArmorFromDrag(itemInstanceId, targetSlot.index);
            } else if (targetSlot.type === 'campfire_fuel') {
                const targetIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                if (isNaN(targetIndexNum)) { console.error("Invalid campfire fuel index", targetSlot.index); setDropError("Invalid slot."); return; }
                let campfireIdNum: number | null = targetSlot.parentId ? Number(targetSlot.parentId) : (interactingWith?.type === 'campfire' ? Number(interactingWith.id) : null);
                if (campfireIdNum === null || isNaN(campfireIdNum)) {
                    console.error("[useDragDropManager Drop] Campfire ID could not be determined.");
                    setDropError("Cannot move item: Campfire context lost.");
                    return;
                }
                if (sourceInfo.sourceSlot.type === 'campfire_fuel') {
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (isNaN(sourceIndexNum)) { console.error("Invalid source campfire fuel index", sourceInfo.sourceSlot.index); setDropError("Invalid source slot."); return; }
                    if (sourceInfo.sourceSlot.parentId && Number(sourceInfo.sourceSlot.parentId) !== campfireIdNum) {
                        setDropError("Cannot move fuel between different campfires.");
                        return;
                    }
                    // console.log(`[useDragDropManager Drop] Calling moveFuelWithinCampfire`);
                    connection.reducers.moveFuelWithinCampfire(campfireIdNum, sourceIndexNum, targetIndexNum);
                } else {
                    // console.log(`[useDragDropManager Drop] Calling addFuelToCampfire`);
                    connection.reducers.addFuelToCampfire(campfireIdNum, targetIndexNum, itemInstanceId);
                }
            } else if (targetSlot.type === 'wooden_storage_box') {
                const targetIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                if (isNaN(targetIndexNum)) { console.error("Invalid box index", targetSlot.index); setDropError("Invalid slot."); return; }
                const boxIdNum = targetSlot.parentId ? Number(targetSlot.parentId) : (interactingWith?.type === 'wooden_storage_box' ? Number(interactingWith.id) : null);
                if (boxIdNum === null || isNaN(boxIdNum)) {
                    console.error("[useDragDropManager Drop] Box ID could not be determined.");
                    setDropError("Cannot move item: Box context lost.");
                    return;
                }
                const source_type = sourceInfo.sourceSlot.type.trim();
                if (source_type === 'inventory' || source_type === 'hotbar' || source_type === 'equipment') {
                    // console.log(`[useDragDropManager Drop] Calling move_item_to_box`);
                    connection.reducers.moveItemToBox(boxIdNum, targetIndexNum, itemInstanceId);
                } else if (source_type === 'wooden_storage_box') {
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (isNaN(sourceIndexNum)) { console.error("Invalid source box index", sourceInfo.sourceSlot.index); setDropError("Invalid source slot."); return; }
                    if (sourceInfo.sourceSlot.parentId && Number(sourceInfo.sourceSlot.parentId) !== boxIdNum) {
                        setDropError("Cannot move items between different boxes yet.");
                        return;
                    }
                    // console.log(`[useDragDropManager Drop] Calling move_item_within_box`);
                    connection.reducers.moveItemWithinBox(boxIdNum, sourceIndexNum, targetIndexNum);
                } else {
                    console.warn(`[useDragDropManager Drop] Unhandled move from ${sourceInfo.sourceSlot.type} to wooden_storage_box`);
                    setDropError("Cannot move item from this location to a box.");
                }
            } else if (targetSlot.type === 'player_corpse') {
                const targetIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                if (isNaN(targetIndexNum)) { console.error("Invalid corpse slot index", targetSlot.index); setDropError("Invalid slot."); return; }
                const corpseIdBigInt = targetSlot.parentId ? BigInt(targetSlot.parentId) : (interactingWith?.type === 'player_corpse' ? BigInt(interactingWith.id) : null);
                if (corpseIdBigInt === null) {
                    console.error("[useDragDropManager Drop] Corpse ID could not be determined for target.");
                    setDropError("Cannot move item: Corpse context lost.");
                    return;
                }
                const corpseIdU32 = Number(corpseIdBigInt); // Convert for reducer
                const source_type = sourceInfo.sourceSlot.type.trim();

                if (source_type === 'inventory' || source_type === 'hotbar' || source_type === 'equipment') {
                    // Revert back to the logically correct reducer name
                    // despite the persistent linter error.
                    console.log(`[useDragDropManager Drop] Calling moveItemToCorpse (linter error expected)`);
                    connection.reducers.moveItemToCorpse(corpseIdU32, targetIndexNum, itemInstanceId);
                } else if (source_type === 'player_corpse') {
                    // <<< Move Within Corpse >>>
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (isNaN(sourceIndexNum)) { console.error("Invalid source corpse index", sourceInfo.sourceSlot.index); setDropError("Invalid source slot."); return; }
                    const sourceCorpseIdBigInt = sourceInfo.sourceSlot.parentId ? BigInt(sourceInfo.sourceSlot.parentId) : null;
                    if (sourceCorpseIdBigInt !== corpseIdBigInt) {
                        setDropError("Cannot move items between different corpses yet.");
                        return;
                    }
                    connection.reducers.moveItemWithinCorpse(corpseIdU32, sourceIndexNum, targetIndexNum);
                } else {
                    console.warn(`[useDragDropManager Drop] Unhandled move from ${sourceInfo.sourceSlot.type} to player_corpse`);
                    setDropError("Cannot move item from this location to a corpse.");
                }
            } else if (targetSlot.type === 'stash') { // New block for moving TO stash
                const targetIndexNum = typeof targetSlot.index === 'number' ? targetSlot.index : parseInt(targetSlot.index.toString(), 10);
                if (isNaN(targetIndexNum)) { console.error("Invalid stash index", targetSlot.index); setDropError("Invalid slot."); return; }
                const stashIdNum = targetSlot.parentId ? Number(targetSlot.parentId) : (interactingWith?.type === 'stash' ? Number(interactingWith.id) : null);
                if (stashIdNum === null || isNaN(stashIdNum)) {
                    console.error("[useDragDropManager Drop] Stash ID could not be determined.");
                    setDropError("Cannot move item: Stash context lost.");
                    return;
                }
                const source_type = sourceInfo.sourceSlot.type.trim();
                if (source_type === 'inventory' || source_type === 'hotbar' || source_type === 'equipment') {
                    console.log(`[useDragDropManager Drop] Calling move_item_to_stash (StashID: ${stashIdNum}, Slot: ${targetIndexNum}, Item: ${itemInstanceId})`);
                    connection.reducers.moveItemToStash(stashIdNum, targetIndexNum, itemInstanceId);
                } else if (source_type === 'stash') {
                    const sourceIndexNum = typeof sourceInfo.sourceSlot.index === 'number' ? sourceInfo.sourceSlot.index : parseInt(sourceInfo.sourceSlot.index.toString(), 10);
                    if (isNaN(sourceIndexNum)) { console.error("Invalid source stash index", sourceInfo.sourceSlot.index); setDropError("Invalid source slot."); return; }
                    if (sourceInfo.sourceSlot.parentId && Number(sourceInfo.sourceSlot.parentId) !== stashIdNum) {
                        setDropError("Cannot move items between different stashes yet.");
                        return;
                    }
                    console.log(`[useDragDropManager Drop] Calling move_item_within_stash (StashID: ${stashIdNum}, FromSlot: ${sourceIndexNum}, ToSlot: ${targetIndexNum})`);
                    connection.reducers.moveItemWithinStash(stashIdNum, sourceIndexNum, targetIndexNum);
                } else {
                    console.warn(`[useDragDropManager Drop] Unhandled move from ${sourceInfo.sourceSlot.type} to stash`);
                    setDropError("Cannot move item from this location to a stash.");
                }
            }
        } catch (error: any) {
            console.error("[useDragDropManager Drop] Error handling drop:", error);
            setDropError(`Failed to handle drop: ${error?.message || error}`);
        }
    }, [connection, interactingWith, playerIdentity]);

    return { draggedItemInfo, dropError, handleItemDragStart, handleItemDrop };
};
