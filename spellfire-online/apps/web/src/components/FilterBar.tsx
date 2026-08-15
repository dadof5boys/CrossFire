import type { CardSet } from '@spellfire/shared';
import { EMPTY_FILTER, type Facets, type FilterState } from '../lib/filter.js';

interface Props {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  facets: Facets;
  sets: CardSet[];
  resultCount: number;
  totalCount: number;
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ filter, onChange, facets, sets, resultCount, totalCount }: Props) {
  const setOptions = sets
    .filter((s) => s.class !== 'all')
    .map((s) => ({ value: s.id, label: s.name }));

  return (
    <aside className="flex flex-col gap-3 border-r border-slate-800 bg-slate-900/50 p-4 overflow-y-auto">
      <div>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Search
          <input
            type="search"
            value={filter.query}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
            placeholder="name or text…"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
      </div>
      <Select
        label="Set"
        value={filter.set}
        options={setOptions}
        onChange={(set) => onChange({ ...filter, set })}
      />
      <Select
        label="Type"
        value={filter.type}
        options={facets.types.map((t) => ({ value: t, label: t }))}
        onChange={(type) => onChange({ ...filter, type })}
      />
      <Select
        label="World"
        value={filter.world}
        options={facets.worlds.map((w) => ({ value: w, label: w }))}
        onChange={(world) => onChange({ ...filter, world })}
      />
      <Select
        label="Rarity"
        value={filter.rarity}
        options={facets.rarities.map((r) => ({ value: r, label: r }))}
        onChange={(rarity) => onChange({ ...filter, rarity })}
      />
      <button
        type="button"
        onClick={() => onChange(EMPTY_FILTER)}
        className="mt-1 rounded bg-slate-700 px-2 py-1.5 text-sm hover:bg-slate-600"
      >
        Clear filters
      </button>
      <p className="mt-1 text-xs text-slate-500">
        {resultCount.toLocaleString()} / {totalCount.toLocaleString()} cards
      </p>
    </aside>
  );
}
