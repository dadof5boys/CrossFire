import * as Dialog from '@radix-ui/react-dialog';
import type { Card } from '@spellfire/shared';
import { useAuth } from '../auth/AuthProvider.js';
import { useAuthDialog } from '../auth/authDialogStore.js';
import { cardImageUrl } from '../lib/images.js';
import { useDeckStore } from '../store/deckStore.js';

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-100">{value}</span>
    </p>
  );
}

export function CardDetailDialog({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const add = useDeckStore((s) => s.add);
  const { isAuthed } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);
  const img = card ? cardImageUrl(card) : null;

  return (
    <Dialog.Root open={card !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[90vh] w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
          {card && (
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="sm:w-1/2">
                {img ? (
                  <img src={img} alt={card.title} className="w-full rounded-lg" />
                ) : (
                  <div className="flex aspect-[5/7] items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                    No image
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:w-1/2">
                <Dialog.Title className="text-xl font-semibold">{card.title}</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-400">
                  {card.setId} #{card.number}
                </Dialog.Description>
                <Field label="Type" value={card.type} />
                <Field label="World" value={card.world} />
                <Field label="Rarity" value={card.rarity} />
                <Field label="Bonus" value={card.bonusRaw} />
                <Field label="Blue line" value={card.blueLine} />
                <Field label="Uses" value={card.uses.join(', ')} />
                {card.text && <p className="mt-1 text-sm italic text-slate-200">{card.text}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => (isAuthed ? add(card.id) : openAuth())}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
                  >
                    + Add to deck
                  </button>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
                    >
                      Close
                    </button>
                  </Dialog.Close>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
