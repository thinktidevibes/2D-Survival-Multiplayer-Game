import { Player as SpacetimeDBPlayer, ActiveEquipment as SpacetimeDBActiveEquipment, ItemDefinition as SpacetimeDBItemDefinition, ActiveConsumableEffect, EffectType } from '../../generated';
import { gameConfig } from '../../config/gameConfig';

// --- Constants (copied from GameCanvas for now, consider moving to config) ---
const SWING_DURATION_MS = 150;
const SWING_ANGLE_MAX_RAD = Math.PI / 2.5;
const SLASH_COLOR = 'rgba(255, 255, 255, 0.4)';
const SLASH_LINE_WIDTH = 4;
const PLAYER_HIT_SHAKE_DURATION_MS = 200; // Copied from renderingUtils.ts
const PLAYER_HIT_SHAKE_AMOUNT_PX = 3;   // Copied from renderingUtils.ts

// --- Bandage Animation Constants ---
const BANDAGING_ANIMATION_DURATION_MS = 5000; // Duration of the bandaging animation (MATCHES SERVER: 5 seconds)
const BANDAGING_MAX_ROTATION_RAD = Math.PI / 12; // Max rotation angle (e.g., 15 degrees)
const BANDAGING_WOBBLES = 20; // Number of full back-and-forth wobbles (10 * 2 for twice as fast)

// --- Helper Function for Rendering Equipped Item ---
export const renderEquippedItem = (
  ctx: CanvasRenderingContext2D,
  player: SpacetimeDBPlayer, 
  equipment: SpacetimeDBActiveEquipment,
  itemDef: SpacetimeDBItemDefinition,
  itemImgFromCaller: HTMLImageElement,
  now_ms: number,
  jumpOffset: number,
  itemImages: Map<string, HTMLImageElement>,
  activeConsumableEffects?: Map<string, ActiveConsumableEffect>,
  localPlayerId?: string
) => {
  // --- Calculate Shake Offset (Only if alive) ---
  let shakeX = 0;
  let shakeY = 0;
  if (!player.isDead && player.lastHitTime) { // Check if alive and hit time exists
    const lastHitMs = Number(player.lastHitTime.microsSinceUnixEpoch / 1000n);
    const elapsedSinceHit = now_ms - lastHitMs;
    if (elapsedSinceHit >= 0 && elapsedSinceHit < PLAYER_HIT_SHAKE_DURATION_MS) {
      shakeX = (Math.random() - 0.5) * 2 * PLAYER_HIT_SHAKE_AMOUNT_PX;
      shakeY = (Math.random() - 0.5) * 2 * PLAYER_HIT_SHAKE_AMOUNT_PX;
    }
  }
  // --- End Shake Offset ---

  // --- Item Size and Position ---
  const scale = 0.05; // User's value
  const itemWidth = itemImgFromCaller.width * scale;
  const itemHeight = itemImgFromCaller.height * scale;
  let itemOffsetX = 0; 
  let itemOffsetY = 0; 
  let rotation = 0;
  let isSwinging = false;
  let isSpearThrusting = false;

  // --- Define spear-specific orientation variables ---
  let spearRotation = 0; // This will be the primary rotation for the spear
  let spearScaleX = 1;
  let spearScaleY = 1;
  // --- End spear-specific orientation variables ---

  let pivotX = player.positionX + shakeX;
  let pivotY = player.positionY - jumpOffset + shakeY; 
  
  const handOffsetX = gameConfig.spriteWidth * 0.2; 
  const handOffsetY = gameConfig.spriteHeight * 0.05;

  if (itemDef.name === "Wooden Spear" || itemDef.name === "Stone Spear") {
    // Base rotations to make spear point in player's direction
    // (assuming spear asset points horizontally to the right by default)
    switch (player.direction) {
      case 'up':
        spearRotation = -Math.PI / 2; // Points asset 'up'
        itemOffsetX = 0; 
        itemOffsetY = -gameConfig.spriteHeight * 0.1; 
        break;
      case 'down':
        spearRotation = Math.PI / 2;  // Points asset 'down'
        itemOffsetX = 0;
        itemOffsetY = gameConfig.spriteHeight * 0.1;
        break;
      case 'left':
        spearRotation = Math.PI;      // Points asset 'left'
        itemOffsetX = -gameConfig.spriteWidth * 0.15;
        itemOffsetY = 0; 
        break;
      case 'right':
        spearRotation = 0;            // Points asset 'right' (default asset orientation)
        itemOffsetX = gameConfig.spriteWidth * 0.15;
        itemOffsetY = 0;
        break;
    }

    // Apply user-specified distinct transformations for each direction
    // This switch can override spearRotation from the first switch, set scaling,
    // and now also fine-tune itemOffsetX/Y for each specific spear orientation.
    switch (player.direction) {
      case 'up':
        spearRotation = (Math.PI / 4) + (Math.PI / 2) + (Math.PI / 2); 
        spearScaleX = -1; 
        spearScaleY = -1; 
        // Initial offset from first switch for 'up': itemOffsetX = 0; itemOffsetY = -gameConfig.spriteHeight * 0.1;
        itemOffsetX = 0 + 15; // adjust X for up
        itemOffsetY = (-gameConfig.spriteHeight * 0.1) -20; // adjust Y for up
        break;
      case 'down':
        spearRotation = (Math.PI / 4) + (Math.PI / 2);
        spearScaleX = -1; 
        spearScaleY = 1;
        // Initial offset from first switch for 'down': itemOffsetX = 0; itemOffsetY = gameConfig.spriteHeight * 0.1;
        itemOffsetX = 0 - 15; // adjust X for down (e.g., move left by 5px)
        itemOffsetY = (gameConfig.spriteHeight * 0.1) + 25; // adjust Y for down (e.g., move down by 5px)
        break;
      case 'left':
        spearRotation = Math.PI + (Math.PI / 4);
        spearScaleX = -1; 
        spearScaleY = 1;
        // Initial offset from first switch for 'left': itemOffsetX = -gameConfig.spriteWidth * 0.15; itemOffsetY = 0;
        itemOffsetX = (-gameConfig.spriteWidth * 0.15) - 15; // adjust X for left
        itemOffsetY = 0 + 0; // adjust Y for left
        break;
      case 'right':
        spearRotation = Math.PI / 4; 
        spearScaleX = -1; 
        spearScaleY = 1;
        // Initial offset from first switch for 'right': itemOffsetX = gameConfig.spriteWidth * 0.15; itemOffsetY = 0;
        itemOffsetX = (gameConfig.spriteWidth * 0.15) + 5; // adjust X for right
        itemOffsetY = 0 + 15; // adjust Y for right
        break;
    }
    
    // The pivotX and pivotY are now based on these potentially fine-tuned offsets.
    // The initial calculation of pivotX/Y before this switch might need to be re-evaluated
    // if we don't want to ADD to player.positionX/Y + shakeX/Y + itemOffsetX/Y from the *first* switch.
    // For now, we effectively override the first switch's itemOffset by re-assigning itemOffsetX/Y here.
    // So, the final pivot calculation should directly use these values.

    // Recalculate pivotX, pivotY based on the final itemOffsetX/Y for the spear
    pivotX = player.positionX + shakeX + itemOffsetX;
    pivotY = player.positionY - jumpOffset + shakeY + itemOffsetY;
    
    rotation = spearRotation; // Use the calculated spear rotation

  } else {
    // Original logic for other items' pivot and default orientation
    switch (player.direction) {
        case 'up': 
            itemOffsetX = -handOffsetX * -2.5;
            itemOffsetY = handOffsetY * -1.0;
            pivotX += itemOffsetX;
            pivotY += itemOffsetY; 
            break;
        case 'down': 
            itemOffsetX = handOffsetX * -2.5;
            itemOffsetY = handOffsetY * 1.0; 
            pivotX += itemOffsetX;
            pivotY += itemOffsetY; 
            break;
        case 'left': 
            itemOffsetX = -handOffsetX * 1.5; 
            itemOffsetY = handOffsetY;
            pivotX += itemOffsetX; 
            pivotY += itemOffsetY; 
            break;
        case 'right': 
            itemOffsetX = handOffsetX * 0.5; 
            itemOffsetY = handOffsetY;
            pivotX += itemOffsetX;
            pivotY += itemOffsetY; 
            break;
    }
  }
  // --- End Item Size and Position adjustments ---

  // Store the pivot before animation for the thrust line visual and arc effects
  const preAnimationPivotX = pivotX;
  const preAnimationPivotY = pivotY;

  // --- Swing/Thrust Animation --- 
  const swingStartTime = Number(equipment.swingStartTimeMs);
  const elapsedSwingTime = now_ms - swingStartTime;
  let currentAngle = 0; 
  let thrustDistance = 0; 

  if (elapsedSwingTime < SWING_DURATION_MS) {
      isSwinging = true; 
      const swingProgress = elapsedSwingTime / SWING_DURATION_MS;
      
      if (itemDef.name === "Wooden Spear" || itemDef.name === "Stone Spear") {
          isSpearThrusting = true;
          const SPEAR_MAX_THRUST_EXTENSION = (itemDef as any).attackRange || 100; 
          thrustDistance = Math.sin(swingProgress * Math.PI) * SPEAR_MAX_THRUST_EXTENSION;
          
          // Apply thrust directly to pivotX/pivotY based on world direction
          // The `rotation` variable (which is spearRotation) is for the visual angle.
          switch (player.direction) {
            case 'up':    pivotY -= thrustDistance; break;
            case 'down':  pivotY += thrustDistance; break;
            case 'left':  pivotX -= thrustDistance; break;
            case 'right': pivotX += thrustDistance; break;
          }
          // `rotation` (which is spearRotation) is already set for the spear's pointing direction from earlier logic.
      } else {
          // Swing animation for other items. 
          // currentAngle will be negative or zero, representing a CCW swing if positive was CW (and backwards).
          currentAngle = -(Math.sin(swingProgress * Math.PI) * SWING_ANGLE_MAX_RAD);
          // The 'rotation' variable is used for the slash arc. It should match the item's swing direction.
          rotation = currentAngle; 
      }
  }
  
  // --- Resolve the correct image to render ---
  let imageToRender: HTMLImageElement | undefined = itemImgFromCaller;
  if (itemDef.name === "Torch" && equipment.iconAssetName) {
    const specificTorchImage = itemImages.get(equipment.iconAssetName);
    if (specificTorchImage) {
      imageToRender = specificTorchImage;
    } else {
      console.warn(`[renderEquippedItem] Image for torch state '${equipment.iconAssetName}' not found in itemImages map. Falling back.`);
    }
  }

  if (!imageToRender) {
    return;
  }
  // --- End Image Resolution ---

  ctx.save(); // Overall item rendering context save (applies to pivot translation and general orientation)
  ctx.translate(pivotX, pivotY); 

  // Apply general orientation/scaling based on player direction (and spear specifics)
  if (itemDef.name === "Wooden Spear" || itemDef.name === "Stone Spear") {
    ctx.rotate(rotation); // `rotation` is pre-calculated spearRotation
    ctx.scale(spearScaleX, spearScaleY);
  } else {
    // Non-spear items might have a different base orientation/flip before animation
    // Ensure this scale doesn't affect bandage animation logic if it's drawn separately with its own save/restore
    if (player.direction === 'right' || player.direction === 'up') {
       if (itemDef.name !== "Bandage") { // Don't apply this generic flip if it's a bandage that will handle its own drawing
            ctx.scale(-1, 1); 
       }
    }
  }

  // --- BANDAGE ANIMATION & DRAWING --- 
  let bandageDrawnWithAnimation = false;
  let bandagingStartTimeMs: number | null = null;

  if (activeConsumableEffects && player.identity) {
    for (const effect of activeConsumableEffects.values()) {
      if (effect.playerId.toHexString() === player.identity.toHexString() && effect.effectType.tag === "BandageBurst") {
        bandagingStartTimeMs = Number(effect.startedAt.microsSinceUnixEpoch / 1000n);
        break;
      }
    }
  }

  if (itemDef.name === "Bandage" && bandagingStartTimeMs !== null) {
    const elapsedBandagingTime = now_ms - bandagingStartTimeMs;
    if (elapsedBandagingTime >= 0 && elapsedBandagingTime < BANDAGING_ANIMATION_DURATION_MS) {
      const animationProgress = elapsedBandagingTime / BANDAGING_ANIMATION_DURATION_MS;
      const bandagingRotation = Math.sin(animationProgress * Math.PI * BANDAGING_WOBBLES * 2) * BANDAGING_MAX_ROTATION_RAD;
      
      ctx.save(); // Save for bandage specific animation transforms
      // Bandage rotation is applied here. Pivot is already at item center due to prior ctx.translate(pivotX, pivotY)
      // and items are drawn relative to -itemWidth/2, -itemHeight/2.
      ctx.rotate(bandagingRotation); // Apply the wobble
      ctx.drawImage(imageToRender, -itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight); // Draw centered & rotated bandage
      ctx.restore(); // Restore from bandage specific animation
      bandageDrawnWithAnimation = true;
    }
  }
  // --- END BANDAGE ANIMATION & DRAWING --- 

  // --- REGULAR ITEM DRAWING (AND SWING FOR NON-SPEAR/NON-BANDAGE-ANIMATING) --- 
  if (!bandageDrawnWithAnimation) {
    ctx.save(); // Save for regular item drawing / swing
    if (itemDef.name !== "Wooden Spear" && itemDef.name !== "Stone Spear" && itemDef.name !== "Bandage") {
      // Apply dynamic swing rotation for non-spear, non-bandage items
      // `rotation` here is the dynamic swing angle from earlier logic (currentAngle)
      // This needs to be the `rotation` variable that holds currentAngle for non-spears.
      // The outer `rotation` variable is pre-set for spears and might be 0 for others initially.
      // Let's assume `currentAngle` is the correct variable for dynamic swing here.
      ctx.rotate(currentAngle); // `currentAngle` should be 0 if not swinging
    }
    // If it's a spear, its main rotation is already applied outside this block.
    // If it's a bandage that didn't animate, it will be drawn with no additional rotation here.
    
    ctx.drawImage(imageToRender, -itemWidth / 2, -itemHeight / 2, itemWidth, itemHeight); // Draw centered
    ctx.restore(); // Restore from regular item drawing / swing
  }

  ctx.restore(); // Restore overall item rendering context (matches the first ctx.save() in this block)

  // --- Draw Attack Visual Effect --- 
  if (isSwinging) { 
    if (itemDef.name === "Wooden Spear" || itemDef.name === "Stone Spear") {
        // Draw a "thrust line" effect for the spear
        ctx.save();
        try {
            ctx.beginPath();
            const spearLength = Math.max(itemWidth, itemHeight); 
            
            const lineStartX = preAnimationPivotX; // Start from the hand position
            const lineStartY = preAnimationPivotY;

            // Endpoint calculation needs to use the final spearRotation and the current thrusted pivot
            // The line should go from the hand to the spear's current (thrusted) base.
            const lineEndX = pivotX; // Current base of the spear after thrust
            const lineEndY = pivotY;
            
            ctx.moveTo(lineStartX, lineStartY);
            ctx.lineTo(lineEndX, lineEndY);
            
            ctx.strokeStyle = 'rgba(220, 220, 255, 0.65)'; 
            ctx.lineWidth = SLASH_LINE_WIDTH - 1.5; 
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    } else {
      // Original slash arc effect for non-spear weapons
      ctx.save();
      try {
          const slashRadius = Math.max(itemWidth, itemHeight) * 0.5; 
          let slashStartAngle = 0;
          
          switch(player.direction) {
              case 'up':    slashStartAngle = -Math.PI / 2; break;
              case 'down':  slashStartAngle = Math.PI / 2;  break;
              case 'left':  slashStartAngle = Math.PI;      break;
              case 'right': slashStartAngle = 0;            break;
          }
          // `rotation` here is the dynamic currentAngle of the swing for non-spears
          const slashEndAngle = slashStartAngle + rotation; 
          const counterClockwise = rotation < 0;

          ctx.beginPath();
          // Draw arc centered on the item's pre-swing pivot point (hand position)
          ctx.arc(preAnimationPivotX, preAnimationPivotY, slashRadius, slashStartAngle, slashEndAngle, counterClockwise);
          ctx.strokeStyle = SLASH_COLOR;
          ctx.lineWidth = SLASH_LINE_WIDTH;
          ctx.stroke();
      } finally {
          ctx.restore();
      }
    }
  }
  // --- End Attack Visual Effect ---

}; 