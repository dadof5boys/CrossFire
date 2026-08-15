import { useDraggable } from '@dnd-kit/core';
import type { Card } from '@spellfire/shared';
import { cardImageUrl } from '../lib/images.js';
import { useDeckStore } from '../store/deckStore.js';

export function CardTile({ card, onSelect }: { card: Card; onSelect: (card: Card) => void }) {
  const add = useDeckStore((s) => s.add);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card:${card.id}`,
    data: { cardId: card.id },
  });
  const img = cardImageUrl(card);

  return (
    <div
      className={`flex flex-col rounded-lg border border-slate-800 bg-slate-900 overflow-hidden ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => onSelect(card)}
        className="block aspect-[5/7] bg-slate-800 cursor-grab active:cursor-grabbing"
        title={`${card.title} — click for details, drag to deck`}
      >
        {img ? (
          <img
            src={img}
            alt={card.title}
            loading="lazy"
            className="h-full w-full object-cover pointer-events-none"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-slate-400">
            {card.title}
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-1 p-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={card.title}>
            {card.title}
          </p>
          <p className="text-xs text-slate-400">
            {card.setId} #{card.number} · {card.type}
          </p>
        </div>
        <button
          type="button"
          onClick={() => add(card.id)}
          className="shrink-0 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold hover:bg-emerald-500"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
