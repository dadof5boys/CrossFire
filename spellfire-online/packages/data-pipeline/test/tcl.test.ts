import { describe, expect, it } from 'vitest';
import { extractBracedSet, parseSetVars, splitList } from '../src/tcl.js';

describe('splitList', () => {
  it('splits bare words', () => {
    expect(splitList('a b   c')).toEqual(['a', 'b', 'c']);
  });

  it('treats newlines as whitespace', () => {
    expect(splitList('a\n  b\n\tc')).toEqual(['a', 'b', 'c']);
  });

  it('strips one level of braces and keeps inner braces', () => {
    expect(splitList('{a b} c {d {e f}}')).toEqual(['a b', 'c', 'd {e f}']);
  });

  it('preserves empty brace groups as empty strings', () => {
    expect(splitList('x {} y')).toEqual(['x', '', 'y']);
  });

  it('does not interpret quotes inside braces', () => {
    expect(splitList('{he said "hi"}')).toEqual(['he said "hi"']);
  });

  it('parses a real card row into 13 fields', () => {
    const row =
      '1st   1 {} 13 1 0 Waterdeep {Any champion can use wizard spells.} M Coast. {5 31} {d19 o19} 1';
    const f = splitList(row);
    expect(f).toHaveLength(13);
    expect(f[0]).toBe('1st');
    expect(f[6]).toBe('Waterdeep');
    expect(f[9]).toBe('Coast.');
    expect(splitList(f[11] as string)).toEqual(['d19', 'o19']);
  });
});

describe('extractBracedSet', () => {
  it('extracts a namespaced set assignment', () => {
    const text = 'namespace eval CrossFire {\n  set foo {1 2 3}\n}';
    expect(extractBracedSet(text, 'foo')).toBe('1 2 3');
  });

  it('extracts a fully-qualified variable name', () => {
    const text = 'set CrossFire::cardDataBase {\n  {First Edition}\n  {1st 1 x}\n}';
    const inner = extractBracedSet(text, 'CrossFire::cardDataBase');
    expect(inner).not.toBeNull();
    expect(splitList(inner as string)).toEqual(['First Edition', '1st 1 x']);
  });

  it('returns null when absent', () => {
    expect(extractBracedSet('set bar 5', 'missing')).toBeNull();
  });
});

describe('parseSetVars', () => {
  it('reads set assignments including multiline braced values', () => {
    const text = [
      '# a comment',
      'set tempDeckSize 110',
      'set tempAuthorName {Simon Dorfman}',
      'set tempNotes {line one',
      'line two}',
      'set tempDeck {',
      '  {MI 30} {3rd 99}',
      '}',
    ].join('\n');
    const v = parseSetVars(text);
    expect(v.get('tempDeckSize')).toBe('110');
    expect(v.get('tempAuthorName')).toBe('Simon Dorfman');
    expect(v.get('tempNotes')).toBe('line one\nline two');
    expect(splitList(v.get('tempDeck') as string)).toEqual(['MI 30', '3rd 99']);
  });
});
