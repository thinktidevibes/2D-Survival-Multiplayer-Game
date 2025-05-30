import { DroppedItem } from '../../generated'; // Import generated types
import { GroundEntityConfig, renderConfiguredGroundEntity } from './genericGroundRenderer'; // Import generic renderer
import { imageManager } from './imageManager'; // Import image manager
import { DroppedItem as SpacetimeDBDroppedItem, ItemDefinition as SpacetimeDBItemDefinition } from '../../generated';
import burlapSackImage from '../../assets/doodads/burlap_sack.png'; // Import the sack image
import { applyStandardDropShadow } from './shadowUtils'; // Added import

// Define constants for dropped item rendering
const DROPPED_ITEM_OPACITY = 0.9; // Base opacity for dropped items
const DROPPED_ITEM_HIGHLIGHT_COLOR = 'rgba(255, 255, 255, 0.3)'; // Highlight color for dropped items
const DROPPED_ITEM_HIGHLIGHT_THICKNESS = 2; // Thickness of highlight border

// --- Constants --- 
const DRAW_WIDTH = 48;
const DRAW_HEIGHT = 48;

// --- Config --- 
const droppedItemConfig: GroundEntityConfig<SpacetimeDBDroppedItem & { itemDef?: SpacetimeDBItemDefinition }> = {
    // Always return the burlap sack image URL
    getImageSource: (_entity) => burlapSackImage,

    getTargetDimensions: (_img, _entity) => ({
        width: DRAW_WIDTH,
        height: DRAW_HEIGHT,
    }),

    calculateDrawPosition: (entity, drawWidth, drawHeight) => ({
        // Center the image
        drawX: entity.posX - drawWidth / 2,
        drawY: entity.posY - drawHeight / 2, 
    }),

    getShadowParams: undefined, // Removed to use applyEffects for shadow

    applyEffects: (ctx, entity, nowMs, baseDrawX, baseDrawY, cycleProgress) => {
        // Apply shadow
        applyStandardDropShadow(ctx, { cycleProgress, blur: 3, offsetY: 2 });
        // No other effects for now, so return default offsets
        return { offsetX: 0, offsetY: 0 };
    },

    fallbackColor: '#A0522D', // Brown fallback for sack
};

// Preload the burlap sack image
imageManager.preloadImage(burlapSackImage);

// --- Interface for new renderer function ---
interface RenderDroppedItemParamsNew {
    ctx: CanvasRenderingContext2D;
    item: SpacetimeDBDroppedItem;
    itemDef: SpacetimeDBItemDefinition | undefined;
    nowMs: number; // Keep nowMs for consistency, even if unused
    cycleProgress: number; // Added for shadow
}

// --- Rendering Function (Refactored) ---
export function renderDroppedItem({
    ctx,
    item,
    itemDef,
    nowMs,
    cycleProgress, // Added
}: RenderDroppedItemParamsNew): void {
    // Combine item and itemDef for the generic renderer config
    const entityWithDef = { ...item, itemDef };

    renderConfiguredGroundEntity({
        ctx,
        entity: entityWithDef, // Pass combined object
        config: droppedItemConfig,
        nowMs, 
        entityPosX: item.posX,
        entityPosY: item.posY,
        cycleProgress, // Added
    });
} 