import {
  ALLY_TYPE_ID,
  REALM_TYPE_ID,
  WIZARD_SPELL_TYPE_ID,
  canMoveToZone,
  championCanUse,
  combatTotal,
  isAllyType,
  isChampionType,
  isSpellType,
  resolveChampionCombat,
  resolveRealmAttack,
} from '@spellfire/shared';
import { describe, expect, it } from 'vitest';
import { getCardFacts } from '../src/cards/catalog.js';

describe('shared rules helpers', () => {
  it('treats Waterdeep as a realm and Maligor as a champion', () => {
    expect(getCardFacts('1st/1')?.typeId).toBe(REALM_TYPE_ID);
    expect(getCardFacts('1st/43')?.typeId).toBe(20);
    expect(isChampionType(20)).toBe(true);
    expect(isChampionType(13)).toBe(false);
    expect(getCardFacts('1st/54')?.typeId).toBe(ALLY_TYPE_ID);
    expect(isAllyType(1)).toBe(true);
    expect(isAllyType(20)).toBe(false);
    expect(getCardFacts('1st/96')?.typeId).toBe(WIZARD_SPELL_TYPE_ID);
    expect(isSpellType(19)).toBe(true);
    expect(isSpellType(4)).toBe(true);
    expect(isSpellType(1)).toBe(false);
  });

  it('allows realms only in realms, champions only in pool', () => {
    expect(canMoveToZone(13, 'realms')).toBeNull();
    expect(canMoveToZone(20, 'realms')).toBe('Only realms can enter the realms zone');
    expect(canMoveToZone(20, 'pool')).toBeNull();
    expect(canMoveToZone(13, 'pool')).toBe('Only champions can enter the pool');
    expect(canMoveToZone(13, 'discard')).toBeNull();
    expect(canMoveToZone(20, 'hand')).toBe('Draw with the Draw action');
  });

  it('razes when the attacker bonus is strictly greater', () => {
    expect(resolveRealmAttack(3, null)).toEqual({
      razed: true,
      attackerBonus: 3,
      defenderBonus: 0,
    });
    expect(resolveRealmAttack(3, 5)).toEqual({
      razed: false,
      attackerBonus: 3,
      defenderBonus: 5,
    });
    expect(resolveRealmAttack(5, 5)).toEqual({
      razed: false,
      attackerBonus: 5,
      defenderBonus: 5,
    });
  });

  it('requires a strictly greater champion bonus to win the battlefield', () => {
    expect(resolveChampionCombat(7, 3)).toEqual({
      attackerWins: true,
      attackerBonus: 7,
      defenderBonus: 3,
    });
    expect(resolveChampionCombat(3, 7)).toEqual({
      attackerWins: false,
      attackerBonus: 3,
      defenderBonus: 7,
    });
    expect(resolveChampionCombat(5, 5).attackerWins).toBe(false);
  });

  it('adds ally bonuses onto a champion total', () => {
    expect(combatTotal(3, [4])).toBe(7);
    expect(combatTotal(3, [4, 4])).toBe(11);
    expect(combatTotal(null, [4])).toBe(4);
    expect(combatTotal(7, [])).toBe(7);
    expect(combatTotal(3, [4, 5])).toBe(12);
  });

  it('lets Maligor cast wizard spells but not Azoun', () => {
    const maligor = getCardFacts('1st/43');
    const azoun = getCardFacts('1st/42');
    expect(championCanUse(maligor?.usesCodes, WIZARD_SPELL_TYPE_ID)).toBe(true);
    expect(championCanUse(azoun?.usesCodes, WIZARD_SPELL_TYPE_ID)).toBe(false);
    expect(championCanUse(maligor?.usesCodes, ALLY_TYPE_ID)).toBe(true);
    expect(championCanUse([], 19)).toBe(false);
  });
});
