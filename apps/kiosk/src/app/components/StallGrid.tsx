import type { Stall } from '../data';
import { StallCard } from './StallCard';
import type { FilterState } from './FilterPanel';
import { X, Menu } from 'lucide-react';
import { translations } from '../translations';

interface StallGridProps {
  stalls: Stall[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onStallClick: (stall: Stall) => void;
  onOpenMenu: () => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  language: 'en' | 'ms' | 'zh';
}

export function StallGrid({ stalls, filters, setFilters, onStallClick, onOpenMenu, favorites, onToggleFavorite, language }: StallGridProps) {
  const t = translations[language];

  // Get active filter pills
  const activePills: { group: keyof FilterState, value: string }[] = [];

  if (filters.category) activePills.push({ group: 'category', value: filters.category });
  if (filters.calories) activePills.push({ group: 'calories', value: filters.calories });
  if (filters.voucher) activePills.push({ group: 'voucher', value: filters.voucher });

  filters.dietary.forEach(v => activePills.push({ group: 'dietary', value: v }));
  filters.vendorType.forEach(v => activePills.push({ group: 'vendorType', value: v }));
  filters.distance.forEach(v => activePills.push({ group: 'distance', value: v }));
  filters.availability.forEach(v => activePills.push({ group: 'availability', value: v }));

  const removePill = (group: keyof FilterState, value: string) => {
    setFilters(prev => {
      if (Array.isArray(prev[group])) {
        return { ...prev, [group]: (prev[group] as string[]).filter(v => v !== value) };
      }
      return { ...prev, [group]: null };
    });
  };

  const clearAll = () => {
    setFilters({
      category: null,
      calories: null,
      dietary: [],
      vendorType: [],
      distance: [],
      voucher: null,
      availability: []
    });
  };

  return (
    <div className="bg-[#FAF7F0] p-4 pb-28">
      {/* Top controls: Menu button (opens the quick-actions / dietary sheet) + active filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={onOpenMenu}
          className="flex items-center gap-2 bg-white border border-[#EDE4D4] text-[#1A1208] text-sm font-bold px-4 py-2.5 rounded-full shadow-sm hover:border-[#E8622A]/40 active:scale-95 transition-all shrink-0"
        >
          <Menu className="w-4 h-4 text-[#E8622A]" />
          {t.menu}
        </button>

        {activePills.map((pill, idx) => (
          <div key={idx} className="flex items-center bg-[#FDF0E8] border border-[#EDE4D4] text-[#1A1208] text-sm font-medium px-3 py-1.5 rounded-full shadow-sm">
            {pill.value}
            <button
              onClick={() => removePill(pill.group, pill.value)}
              className="ml-2 text-gray-400 hover:text-black focus:outline-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {activePills.length > 1 && (
          <button
            onClick={clearAll}
            className="text-sm font-semibold text-[#E8622A] hover:text-[#E8622A]/80 ml-1"
          >
            {t.clearAll}
          </button>
        )}
      </div>

      {/* Grid */}
      {stalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-gray-400 mb-4">
            <SearchIcon className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {t.noResults}
          </h3>
          <p className="text-gray-500">
            {t.tryAdjusting}
          </p>
          {activePills.length > 0 && (
            <button
              onClick={clearAll}
              className="mt-6 bg-[#E8622A] text-white px-6 py-2 rounded-full font-medium hover:bg-[#E8622A]/90 transition"
            >
              {t.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {stalls.map(stall => (
            <StallCard
              key={stall.id}
              stall={stall}
              onClick={() => onStallClick(stall)}
              isFavorite={favorites.has(stall.id)}
              onToggleFavorite={() => onToggleFavorite(stall.id)}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
