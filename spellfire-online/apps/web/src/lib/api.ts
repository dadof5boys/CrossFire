import type { DeckInput, SavedDeck } from '@spellfire/shared';
import { supabase } from './supabase.js';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(init.headers ?? {}),
  };
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const deckApi = {
  list: () => request<SavedDeck[]>('/decks'),
  create: (input: DeckInput) =>
    request<SavedDeck>('/decks', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: DeckInput) =>
    request<SavedDeck>(`/decks/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/decks/${id}`, { method: 'DELETE' }),
};
