import * as Dialog from '@radix-ui/react-dialog';
import { type FormEvent, useState } from 'react';
import { useAuth } from './AuthProvider.js';
import { useAuthDialog } from './authDialogStore.js';

export function AuthDialog() {
  const { isOpen, close } = useAuthDialog();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setEmail('');
    setPassword('');
    close();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-400">
            {mode === 'signin'
              ? 'Sign in to build and save decks.'
              : 'Create an account to build and save decks.'}
          </Dialog.Description>
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
            className="mt-3 text-xs text-sky-400 hover:underline"
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
