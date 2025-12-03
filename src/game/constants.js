// Centralised game-balance constants for player stat multipliers and caps.
// These values are used in state.js to clamp the player's stats after applying buffs.
// Adjust as needed to tune game balance.

export const MAX_DAMAGE_MUL = 20;      // Maximum multiplier for damage (base damage is multiplied by this value at cap)
export const MAX_FIRE_MUL   = 20;      // Maximum multiplier for fire rate
export const MAX_RANGE_MUL  = 10;      // Maximum multiplier for weapon range
export const MAX_CRIT_MULT  = 19998;   // Maximum critical multiplier (sizable number because crit multiplies other stats)
export const MAX_MAGNET     = 300;     // Maximum magnetic radius (pickup radius)
export const MAX_SPEED      = 1100;    // Maximum player movement speed
