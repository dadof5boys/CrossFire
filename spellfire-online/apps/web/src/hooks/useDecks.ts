import type { DeckInput, SavedDeck } from '@spellfire/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider.js';
import { deckApi } from '../lib/api.js';

const DECKS_KEY = ['decks'] as const;

/** List the current user's decks (only runs when authenticated). */
export function useDecksQuery() {
  const { isAuthed } = useAuth();
  return useQuery<SavedDeck[]>({
    queryKey: DECKS_KEY,
    queryFn: deckApi.list,
    enabled: isAuthed,
  });
}

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeckInput) => deckApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: DECKS_KEY }),
  });
}

export function useUpdateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeckInput }) => deckApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: DECKS_KEY }),
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deckApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DECKS_KEY }),
  });
}
