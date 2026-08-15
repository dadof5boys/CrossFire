import { DndContext } from '@dnd-kit/core';
import type { Card } from '@spellfire/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardTile } from './CardTile.js';

const card: Card = {
  id: '1st/1',
  setId: '1st',
  number: 1,
  title: 'Waterdeep',
  text: 'Any champion can use wizard spells when defending Waterdeep.',
  typeId: 13,
  type: 'Realm',
  worldId: 1,
  world: 'Forgotten Realms',
  isAvatar: false,
  bonus: null,
  bonusRaw: '',
  rarity: 'M',
  blueLine: 'Coast.',
  attrCodes: ['5', '31'],
  usesCodes: ['d19', 'o19'],
  uses: ['Wizard Spell, Def', 'Wizard Spell, Off'],
  weight: 1,
  image: 'Graphics/Cards/1st/001.jpg',
};

describe('CardTile', () => {
  it('renders the card name, meta, and an add button', () => {
    render(
      <DndContext>
        <CardTile card={card} onSelect={() => {}} />
      </DndContext>,
    );
    expect(screen.getByText('Waterdeep')).toBeInTheDocument();
    expect(screen.getByText(/1st #1 · Realm/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Waterdeep' })).toHaveAttribute(
      'src',
      '/legacy/Graphics/Cards/1st/001.jpg',
    );
  });
});
