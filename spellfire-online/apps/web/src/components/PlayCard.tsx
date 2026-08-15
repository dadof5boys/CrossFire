import { useDraggable } from '@dnd-kit/core';
import type { Card, CardInstance } from '@spellfire/shared';
import { cardImageUrl } from '../lib/images.js';

export function PlayCard({
  instance,
  card,
  faceDown,
  draggable,
  onSelect,
}: {
  instance: CardInstance;
  card?: Card;
  faceDown?: boolean;
  draggable?: boolean;
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
      onClick={() => card && !faceDown && onSelect?.(card)}
      title={title}
      className={`h-24 w-[4.3rem] shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-800 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      {img ? (
        <img src={img} alt={title} className="h-full w-full object-cover pointer-events-none" />
      ) : (
        <span className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-slate-400">
          {faceDown ? '🂠' : title}
        </span>
      )}
    </button>
  );
}
