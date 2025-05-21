import { useEffect, useRef, useCallback, useState } from 'react';
import { Campfire as SpacetimeDBCampfire } from '../generated';
import { CAMPFIRE_RENDER_Y_OFFSET, CAMPFIRE_HEIGHT } from '../utils/renderers/campfireRenderingUtils';

// --- Particle System Types and Constants ---
export interface Particle {
  id: string;
  type: 'fire' | 'smoke' | 'smoke_burst';
  x: number; // world X
  y: number; // world Y
  vx: number;
  vy: number;
  spawnTime: number;
  initialLifetime: number;
  lifetime: number; // remaining lifetime
  size: number;
  color?: string;
  alpha: number;
}

// Adjusted for 2D Pixel Art style & less intensity
const PARTICLE_FIRE_LIFETIME_MIN = 100;
const PARTICLE_FIRE_LIFETIME_MAX = 300;
const PARTICLE_FIRE_SPEED_Y_MIN = -0.15;
const PARTICLE_FIRE_SPEED_Y_MAX = -0.45;
const PARTICLE_FIRE_SPEED_X_SPREAD = 0.2; 
const PARTICLE_FIRE_SIZE_MIN = 2; 
const PARTICLE_FIRE_SIZE_MAX = 3;
const PARTICLE_FIRE_COLORS = ["#FFD878", "#FFB04A", "#FF783C", "#FC9842"]; 
const FIRE_PARTICLES_PER_CAMPFIRE_FRAME = 0.6; 

const PARTICLE_SMOKE_LIFETIME_MIN = 1000;
const PARTICLE_SMOKE_LIFETIME_MAX = 2500;
const PARTICLE_SMOKE_SPEED_Y_MIN = -0.15; 
const PARTICLE_SMOKE_SPEED_Y_MAX = -0.4;
const PARTICLE_SMOKE_SPEED_X_SPREAD = 0.3;
const PARTICLE_SMOKE_SIZE_MIN = 3;
const PARTICLE_SMOKE_SIZE_MAX = 5; 
const PARTICLE_SMOKE_GROWTH_RATE = 0.02;
const SMOKE_PARTICLES_PER_CAMPFIRE_FRAME = 0.3; 
const SMOKE_INITIAL_ALPHA = 0.4;
const SMOKE_TARGET_ALPHA = 0.05; 
const SMOKE_LINGER_DURATION_MS = 2500; // How long smoke continues after fire is out

// --- ADDED: Smoke Burst Constants ---
const SMOKE_BURST_PARTICLE_COUNT = 15; // Reduced for performance, adjust as needed
const SMOKE_BURST_COLOR = "#000000";
const SMOKE_BURST_LIFETIME_MIN = 500;
const SMOKE_BURST_LIFETIME_MAX = 1200;
const SMOKE_BURST_SPEED_X_SPREAD = 0.4;
const SMOKE_BURST_SPEED_Y_MIN = -0.1;
const SMOKE_BURST_SPEED_Y_MAX = -0.3;
const SMOKE_BURST_SIZE_MIN = 2;
const SMOKE_BURST_SIZE_MAX = 4;
const SMOKE_BURST_INITIAL_ALPHA = 0.7;
// --- END ADDED ---

// --- Define constants for particle emitter positions relative to visual campfire center ---
// These values are measured as offsets from the visual center, not the entity base position
// Positive Y values move up from the center, negative values move down from the center
const FIRE_EMISSION_CENTER_Y_OFFSET = CAMPFIRE_HEIGHT * -0.30; // 35% up from center of visual bounds
const SMOKE_EMISSION_CENTER_Y_OFFSET = CAMPFIRE_HEIGHT * 0.15; // 40% up from center of visual bounds

interface UseCampfireParticlesProps {
    visibleCampfiresMap: Map<string, SpacetimeDBCampfire>;
    deltaTime: number; // Delta time in milliseconds
}

export function useCampfireParticles({
    visibleCampfiresMap,
    deltaTime,
}: UseCampfireParticlesProps): Particle[] {
    const [particles, setParticles] = useState<Particle[]>([]);
    
    const fireEmissionAccumulatorRef = useRef<Map<string, number>>(new Map());
    const smokeEmissionAccumulatorRef = useRef<Map<string, number>>(new Map());
    const smokeBurstEmissionAccumulatorRef = useRef<Map<string, number>>(new Map()); // For continuous burst
    const prevBurningStatesRef = useRef<Map<string, boolean>>(new Map());
    const lingeringSmokeDataRef = useRef<Map<string, { lingerUntil: number }>>(new Map());

    useEffect(() => {
        if (deltaTime <= 0) return; // Don't update if deltaTime is not positive

        const now = performance.now();
        setParticles(prevParticles => {
            const updatedAndActiveParticles = prevParticles.map(p => {
                const age = now - p.spawnTime;
                const lifetimeRemaining = p.initialLifetime - age;
                const normalizedDeltaTimeFactor = deltaTime / 16.667; 

                let newVx = p.vx;
                let newVy = p.vy;
                let newSize = p.size;
                let currentAlpha = p.alpha;

                if (p.type === 'smoke') {
                    newVy -= 0.003 * normalizedDeltaTimeFactor; 
                    newSize = Math.min(p.size + PARTICLE_SMOKE_GROWTH_RATE * normalizedDeltaTimeFactor, PARTICLE_SMOKE_SIZE_MAX);
                    const lifeRatio = Math.max(0, lifetimeRemaining / p.initialLifetime);
                    currentAlpha = SMOKE_TARGET_ALPHA + (SMOKE_INITIAL_ALPHA - SMOKE_TARGET_ALPHA) * lifeRatio;
                } else if (p.type === 'fire') {
                     const lifeRatio = Math.max(0, lifetimeRemaining / p.initialLifetime);
                     currentAlpha = lifeRatio; 
                } else if (p.type === 'smoke_burst') {
                    newVy -= 0.0015 * normalizedDeltaTimeFactor;
                    const lifeRatio = Math.max(0, lifetimeRemaining / p.initialLifetime);
                    currentAlpha = SMOKE_TARGET_ALPHA + ((SMOKE_INITIAL_ALPHA + 0.4) - SMOKE_TARGET_ALPHA) * lifeRatio;
                }

                return {
                    ...p,
                    x: p.x + newVx * normalizedDeltaTimeFactor,
                    y: p.y + newVy * normalizedDeltaTimeFactor,
                    lifetime: lifetimeRemaining,
                    size: newSize,
                    alpha: Math.max(0, Math.min(1, currentAlpha)), 
                };
            }).filter(p => p.lifetime > 0 && p.alpha > 0.01); 

            const newGeneratedParticles: Particle[] = [];
            const currentVisibleCampfireIds = new Set<string>();

            if (visibleCampfiresMap) {
                visibleCampfiresMap.forEach((campfire, campfireId) => {
                    currentVisibleCampfireIds.add(campfireId);
                    const wasBurning = prevBurningStatesRef.current.get(campfireId) || false;
                    const isCurrentlyBurning = campfire.isBurning;

                    let generateFireThisFrame = false;
                    let generateSmokeThisFrame = false;
                    let lingeringEntry = lingeringSmokeDataRef.current.get(campfireId);

                    if (isCurrentlyBurning) {
                        generateFireThisFrame = true;
                        generateSmokeThisFrame = true;
                        if (lingeringEntry) {
                            lingeringSmokeDataRef.current.delete(campfireId);
                            lingeringEntry = undefined; 
                        }
                    } else { // Not currently burning
                        if (wasBurning) { // Transitioned from on to off this frame
                            lingeringEntry = { lingerUntil: now + SMOKE_LINGER_DURATION_MS };
                            lingeringSmokeDataRef.current.set(campfireId, lingeringEntry);
                        }
                        if (lingeringEntry && now < lingeringEntry.lingerUntil) {
                            generateSmokeThisFrame = true; // Linger smoke
                        } else if (lingeringEntry && now >= lingeringEntry.lingerUntil) {
                            lingeringSmokeDataRef.current.delete(campfireId); // Lingering period over
                        }
                    }
                    prevBurningStatesRef.current.set(campfireId, isCurrentlyBurning);

                    // OPTIMIZATION: Calculate the visual center of the campfire for particle emission
                    const visualCenterX = campfire.posX;
                    const visualCenterY = campfire.posY - (CAMPFIRE_HEIGHT / 2) - CAMPFIRE_RENDER_Y_OFFSET;
                    
                    // Calculate emission points based on visual center
                    const fireEmissionX = visualCenterX;
                    const fireEmissionY = visualCenterY + FIRE_EMISSION_CENTER_Y_OFFSET;
                    
                    const smokeEmissionX = visualCenterX;
                    const smokeEmissionY = visualCenterY + SMOKE_EMISSION_CENTER_Y_OFFSET;

                    if (generateFireThisFrame) {
                        let fireAcc = fireEmissionAccumulatorRef.current.get(campfireId) || 0;
                        fireAcc += FIRE_PARTICLES_PER_CAMPFIRE_FRAME * (deltaTime / 16.667); 
                        while (fireAcc >= 1) {
                            fireAcc -= 1;
                            const lifetime = PARTICLE_FIRE_LIFETIME_MIN + Math.random() * (PARTICLE_FIRE_LIFETIME_MAX - PARTICLE_FIRE_LIFETIME_MIN);
                            newGeneratedParticles.push({
                                id: `fire_${now}_${Math.random()}`, type: 'fire',
                                x: fireEmissionX + (Math.random() - 0.5) * 8, 
                                y: fireEmissionY + (Math.random() - 0.5) * 5, 
                                vx: (Math.random() - 0.5) * PARTICLE_FIRE_SPEED_X_SPREAD,
                                vy: PARTICLE_FIRE_SPEED_Y_MIN + Math.random() * (PARTICLE_FIRE_SPEED_Y_MAX - PARTICLE_FIRE_SPEED_Y_MIN),
                                spawnTime: now, initialLifetime: lifetime, lifetime,
                                size: Math.floor(PARTICLE_FIRE_SIZE_MIN + Math.random() * (PARTICLE_FIRE_SIZE_MAX - PARTICLE_FIRE_SIZE_MIN)) + 1,
                                color: PARTICLE_FIRE_COLORS[Math.floor(Math.random() * PARTICLE_FIRE_COLORS.length)],
                                alpha: 1.0, 
                            });
                        }
                        fireEmissionAccumulatorRef.current.set(campfireId, fireAcc);
                    } else {
                        fireEmissionAccumulatorRef.current.set(campfireId, 0);
                    }

                    if (generateSmokeThisFrame) {
                        let smokeAcc = smokeEmissionAccumulatorRef.current.get(campfireId) || 0;
                        smokeAcc += SMOKE_PARTICLES_PER_CAMPFIRE_FRAME * (deltaTime / 16.667); 
                        while (smokeAcc >= 1) {
                            smokeAcc -= 1;
                            const lifetime = PARTICLE_SMOKE_LIFETIME_MIN + Math.random() * (PARTICLE_SMOKE_LIFETIME_MAX - PARTICLE_SMOKE_LIFETIME_MIN);
                            newGeneratedParticles.push({
                                id: `smoke_${now}_${Math.random()}`, type: 'smoke',
                                x: smokeEmissionX + (Math.random() - 0.5) * 8, 
                                y: smokeEmissionY + (Math.random() - 0.5) * 8,
                                vx: (Math.random() - 0.5) * PARTICLE_SMOKE_SPEED_X_SPREAD,
                                vy: PARTICLE_SMOKE_SPEED_Y_MIN + Math.random() * (PARTICLE_SMOKE_SPEED_Y_MAX - PARTICLE_SMOKE_SPEED_Y_MIN),
                                spawnTime: now, initialLifetime: lifetime, lifetime,
                                size: Math.floor(PARTICLE_SMOKE_SIZE_MIN + Math.random() * (PARTICLE_SMOKE_SIZE_MAX - PARTICLE_SMOKE_SIZE_MIN)) + 1,
                                alpha: SMOKE_INITIAL_ALPHA,
                            });
                        }
                        smokeEmissionAccumulatorRef.current.set(campfireId, smokeAcc);
                    } else {
                        smokeEmissionAccumulatorRef.current.set(campfireId, 0);
                    }

                    // --- Continuous Smoke Burst Logic (if player is in hot zone) ---
                    if (campfire.isPlayerInHotZone) {
                        let burstAcc = smokeBurstEmissionAccumulatorRef.current.get(campfireId) || 0;
                        // Adjust emission rate for burst, e.g., 2 particles per frame equivalent
                        burstAcc += 2.0 * (deltaTime / 16.667); 
                        while (burstAcc >= 1) {
                            burstAcc -= 1;
                            const lifetime = SMOKE_BURST_LIFETIME_MIN + Math.random() * (SMOKE_BURST_LIFETIME_MAX - SMOKE_BURST_LIFETIME_MIN);
                            newGeneratedParticles.push({
                                id: `smokeburst_${campfireId}_${now}_${Math.random()}`,
                                type: 'smoke_burst',
                                x: visualCenterX + (Math.random() - 0.5) * 20, // Smaller spread for continuous effect
                                y: visualCenterY + (Math.random() - 0.5) * 15, // Smaller spread
                                vx: (Math.random() - 0.5) * SMOKE_BURST_SPEED_X_SPREAD,
                                vy: SMOKE_BURST_SPEED_Y_MIN + Math.random() * (SMOKE_BURST_SPEED_Y_MAX - SMOKE_BURST_SPEED_Y_MIN),
                                spawnTime: now, initialLifetime: lifetime, lifetime,
                                size: SMOKE_BURST_SIZE_MIN + Math.floor(Math.random() * (SMOKE_BURST_SIZE_MAX - SMOKE_BURST_SIZE_MIN + 1)),
                                color: SMOKE_BURST_COLOR,
                                alpha: SMOKE_BURST_INITIAL_ALPHA,
                            });
                        }
                        smokeBurstEmissionAccumulatorRef.current.set(campfireId, burstAcc);
                    } else {
                        smokeBurstEmissionAccumulatorRef.current.set(campfireId, 0); // Reset if not in hot zone
                    }
                });
            }

            // Cleanup refs for campfires no longer in visibleCampfiresMap
            prevBurningStatesRef.current.forEach((_, campfireId) => {
                if (!currentVisibleCampfireIds.has(campfireId)) {
                    prevBurningStatesRef.current.delete(campfireId);
                    fireEmissionAccumulatorRef.current.delete(campfireId);
                    smokeEmissionAccumulatorRef.current.delete(campfireId);
                    smokeBurstEmissionAccumulatorRef.current.delete(campfireId); // Cleanup burst accumulator
                    lingeringSmokeDataRef.current.delete(campfireId);
                }
            });
            lingeringSmokeDataRef.current.forEach((_, campfireId) => {
                 if (!currentVisibleCampfireIds.has(campfireId)) {
                    lingeringSmokeDataRef.current.delete(campfireId);
                }
            });
            smokeBurstEmissionAccumulatorRef.current.forEach((_, campfireId) => { // Ensure burst accumulator is also cleaned up
                if (!currentVisibleCampfireIds.has(campfireId)) {
                    smokeBurstEmissionAccumulatorRef.current.delete(campfireId);
                }
            });

            return [...updatedAndActiveParticles, ...newGeneratedParticles];
        });
    }, [visibleCampfiresMap, deltaTime]);

    return particles;
} 