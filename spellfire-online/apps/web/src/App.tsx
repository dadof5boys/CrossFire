import { NavLink, Route, Routes } from 'react-router-dom';
import { AuthDialog } from './auth/AuthDialog.js';
import { useAuth } from './auth/AuthProvider.js';
import { useAuthDialog } from './auth/authDialogStore.js';
import { DatasetProvider } from './data/DatasetProvider.js';
import BrowsePage from './routes/BrowsePage.js';
import DecksPage from './routes/DecksPage.js';

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
  }`;
}

function AuthControls() {
  const { isAuthed, user, signOut } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);

  if (isAuthed) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400">{user?.email}</span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
        >
          Sign out
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={openAuth}
      className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
    >
      Sign in
    </button>
  );
}

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          Spellfire <span className="text-emerald-400">Online</span>
        </h1>
        <nav className="flex gap-1">
          <NavLink to="/" end className={navClass}>
            Browse
          </NavLink>
          <NavLink to="/decks" className={navClass}>
            Decks
          </NavLink>
        </nav>
        <div className="ml-auto">
          <AuthControls />
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <DatasetProvider>
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route path="/decks" element={<DecksPage />} />
          </Routes>
        </DatasetProvider>
      </main>
      <AuthDialog />
    </div>
  );
}
