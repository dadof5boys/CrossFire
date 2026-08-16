import type { PlayZone } from './play.js';

/** Champion typeIds from the CrossFire card-type table. */
export const CHAMPION_TYPE_IDS = [5, 7, 10, 12, 14, 16, 20] as const;
export type ChampionTypeId = (typeof CHAMPION_TYPE_IDS)[number];

export const REALM_TYPE_ID = 13;

/** Informal CrossFire phase radios: 0 start, 1–3 build, 4 combat, 5 end. */
export const COMBAT_PHASE = 4;
export const END_PHASE = 5;

export const PHASE_LABELS = ['Start', 'First', 'Second', 'Third', 'Combat', 'End'] as const;

export function isChampionType(typeId: number): boolean {
  return (CHAMPION_TYPE_IDS as readonly number[]).includes(typeId);
}

export function numericBonus(bonus: number | null | undefined): number {
  return bonus ?? 0;
}

/**
 * Zone legality for a player moving their own card.
 * Hand and draw are filled only by `play:draw`.
 */
export function canMoveToZone(typeId: number, toZone: PlayZone): string | null {
  if (toZone === 'hand' || toZone === 'draw') return 'Draw with the Draw action';
  if (toZone === 'discard') return null;
  if (toZone === 'realms') {
    return typeId === REALM_TYPE_ID ? null : 'Only realms can enter the realms zone';
  }
  if (toZone === 'pool') {
    return isChampionType(typeId) ? null : 'Only champions can enter the pool';
  }
  return 'Illegal zone';
}

export function resolveRealmAttack(
  attackerBonus: number | null,
  defenderBonus: number | null,
): { razed: boolean; attackerBonus: number; defenderBonus: number } {
  const atk = numericBonus(attackerBonus);
  const def = numericBonus(defenderBonus);
  return { razed: atk > def, attackerBonus: atk, defenderBonus: def };
}

/** Champion vs champion. Attacker must be strictly greater to win. */
export function resolveChampionCombat(
  attackerBonus: number | null,
  defenderBonus: number | null,
): { attackerWins: boolean; attackerBonus: number; defenderBonus: number } {
  const atk = numericBonus(attackerBonus);
  const def = numericBonus(defenderBonus);
  return { attackerWins: atk > def, attackerBonus: atk, defenderBonus: def };
}
