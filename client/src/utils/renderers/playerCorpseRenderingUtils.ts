import { PlayerCorpse } from '../../generated';
import { GroundEntityConfig, renderConfiguredGroundEntity } from './genericGroundRenderer';
import { imageManager } from './imageManager';
import { Player as SpacetimeDBPlayer } from '../../generated/player_type';
import { renderPlayer, IDLE_FRAME_INDEX } from './playerRenderingUtils';
import { Identity, Timestamp } from '@clockworklabs/spacetimedb-sdk';
import type { RefObject } from 'react';

interface RenderPlayerCorpseProps {
  ctx: CanvasRenderingContext2D;
  corpse: PlayerCorpse;
  nowMs: number;
  itemImagesRef: { current: Map<string, HTMLImageElement> | null };
  worldScale: number;
  cameraOffsetX: number;
  cameraOffsetY: number;
}

export const PLAYER_CORPSE_INTERACTION_DISTANCE_SQUARED = 64.0 * 64.0;

// Define constants for player corpse rendering
const CORPSE_OPACITY = 0.8; // Base opacity for player corpses
const CORPSE_HIGHLIGHT_COLOR = 'rgba(255, 255, 255, 0.3)'; // Highlight color for player corpses
const CORPSE_HIGHLIGHT_THICKNESS = 2; // Thickness of highlight border

/**
 * Renders a player corpse entity onto the canvas using player sprite logic.
 */
export function renderPlayerCorpse({
  ctx,
  corpse,
  nowMs,
  itemImagesRef,
  worldScale,
  cameraOffsetX,
  cameraOffsetY,
}: RenderPlayerCorpseProps): void {
  
  const heroImg = itemImagesRef.current?.get('hero');
  if (!heroImg) {
    console.warn("[renderPlayerCorpse] Hero image not loaded, cannot render corpse sprite.");
    return;
  }

  // Revert to using __timestamp_micros_since_unix_epoch__ as per the linter error
  const defaultTimestamp: Timestamp = { __timestamp_micros_since_unix_epoch__: 0n } as Timestamp;
  // Added a cast to Timestamp to satisfy the type if it has other non-data properties or methods.

  const mockPlayerForCorpse: SpacetimeDBPlayer = {
    identity: corpse.playerIdentity as Identity,
    username: corpse.username,
    positionX: corpse.posX,
    positionY: corpse.posY,
    direction: 'up',
    color: '#CCCCCC',
    health: 0,
    isDead: true,
    lastHitTime: undefined,
    jumpStartTimeMs: 0n,
    isSprinting: false,
    hunger: 0,
    thirst: 0,
    stamina: 0,
    lastUpdate: defaultTimestamp,
    lastStatUpdate: defaultTimestamp,
    warmth: 0,
    deathTimestamp: corpse.deathTime,
    isOnline: false,
    isTorchLit: false,
    lastConsumedAt: defaultTimestamp,
    isCrouching: false,
  };

  renderPlayer(
    ctx,
    mockPlayerForCorpse,
    heroImg,
    false,
    false,
    false,
    IDLE_FRAME_INDEX,
    nowMs,
    0,
    false,
    undefined,
    undefined,
    true
  );
} 