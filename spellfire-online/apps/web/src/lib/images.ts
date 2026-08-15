import type { Card } from '@spellfire/shared';

/**
 * Resolve a card's image to a URL the dev server can serve. The dataset stores
 * repo-relative paths (e.g. `Graphics/Cards/1st/001.jpg`); the Vite dev
 * middleware serves those under `/legacy/...`.
 */
export function cardImageUrl(card: Pick<Card, 'image'>): string | null {
  return card.image ? `/legacy/${card.image}` : null;
}
