import type { PlayZone } from './play.js';

/** Champion typeIds from the CrossFire card-type table. */
export const CHAMPION_TYPE_IDS = [5, 7, 10, 12, 14, 16, 20] as const;
export type ChampionTypeId = (typeof CHAMPION_TYPE_IDS)[number];

export const REALM_TYPE_ID = 13;
export const ALLY_TYPE_ID = 1;
export const CLERIC_SPELL_TYPE_ID = 4;
export const WIZARD_SPELL_TYPE_ID = 19;

/** Informal CrossFire phase radios: 0 start, 1–3 build, 4 combat, 5 end. */
export const COMBAT_PHASE = 4;
export const END_PHASE = 5;

export const PHASE_LABELS = ['Start', 'First', 'Second', 'Third', 'Combat', 'End'] as const;

export function isChampionType(typeId: number): boolean {
  return (CHAMPION_TYPE_IDS as readonly number[]).includes(typeId);
}

export function isAllyType(typeId: number): boolean {
  return typeId === ALLY_TYPE_ID;
}

export function isSpellType(typeId: number): boolean {
  return typeId === CLERIC_SPELL_TYPE_ID || typeId === WIZARD_SPELL_TYPE_ID;
}

/** Champion `usesCodes` are `typeId`, `d<typeId>`, or `o<typeId>`. */
export function championCanUse(usesCodes: readonly string[] | undefined, typeId: number): boolean {
  if (!usesCodes || usesCodes.length === 0) return false;
  const id = String(typeId);
  return usesCodes.some((code) => code === id || code === `d${id}` || code === `o${id}`);
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

/** Champion bonus plus attached ally/spell bonuses for one side of a fight. */
export function combatTotal(
  championBonus: number | null | undefined,
  attachedBonuses: Array<number | null | undefined> = [],
): number {
  let total = numericBonus(championBonus);
  for (const bonus of attachedBonuses) {
    total += numericBonus(bonus);
  }
  return total;
}
