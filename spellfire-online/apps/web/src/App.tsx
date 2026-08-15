import { NavLink, Route, Routes } from 'react-router-dom';
import { DatasetProvider } from './data/DatasetProvider.js';
import BrowsePage from './routes/BrowsePage.js';
import DecksPage from './routes/DecksPage.js';

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
  }`;
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
      </header>
      <main className="min-h-0 flex-1">
        <DatasetProvider>
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route path="/decks" element={<DecksPage />} />
          </Routes>
        </DatasetProvider>
      </main>
    </div>
  );
}
