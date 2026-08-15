import {
  REALM_TYPE_ID,
  canMoveToZone,
  isChampionType,
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
});
