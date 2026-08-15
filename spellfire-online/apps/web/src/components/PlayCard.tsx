import { useDraggable } from '@dnd-kit/core';
import type { Card, CardInstance } from '@spellfire/shared';
import { cardImageUrl } from '../lib/images.js';

export function PlayCard({
  instance,
  card,
  faceDown,
  draggable,
  selected,
  razed,
  onPick,
  onSelect,
}: {
  instance: CardInstance;
  card?: Card;
  faceDown?: boolean;
  draggable?: boolean;
  selected?: boolean;
  razed?: boolean;
  onPick?: (instanceId: string) => void;
  onSelect?: (card: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: instance.instanceId,
    data: { instanceId: instance.instanceId },
    disabled: !draggable,
  });
  const img = card && !faceDown ? cardImageUrl(card) : null;
  const title = faceDown ? 'Facedown card' : (card?.title ?? instance.cardId);

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      onClick={() => {
        onPick?.(instance.instanceId);
        if (card && !faceDown) onSelect?.(card);
      }}
      title={title}
      aria-pressed={selected}
      className={`relative h-24 w-[4.3rem] shrink-0 overflow-hidden rounded border bg-slate-800 ${
        selected ? 'border-emerald-400 ring-2 ring-emerald-400' : 'border-slate-700'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : ''} ${
        razed ? 'opacity-70' : ''
      }`}
    >
      {img ? (
        <img src={img} alt={title} className="h-full w-full object-cover pointer-events-none" />
      ) : (
        <span className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-slate-400">
          {faceDown ? '🂠' : title}
        </span>
      )}
      {razed ? (
        <span className="absolute inset-x-0 bottom-0 bg-red-800/90 text-center text-[9px] font-bold uppercase tracking-wide text-red-100">
          Razed
        </span>
      ) : null}
    </button>
  );
}
