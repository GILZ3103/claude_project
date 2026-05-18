import type { Stall } from '../data';
import { StallCard } from './StallCard';
import type { FilterState } from './FilterPanel';
import { X } from 'lucide-react';
import { translations } from '../translations';

interface StallGridProps {
  stalls: Stall[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onStallClick: (stall: Stall) => void;
  language: 'en' | 'ms' | 'zh';
}

export function StallGrid({ stalls, filters, setFilters, onStallClick, language }: StallGridProps) {
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
    <div className="flex-1 h-full overflow-y-auto bg-[#F7F7F5] p-6">
      {/* Filter Pills Header */}
      {activePills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm font-medium text-gray-500 mr-2">{t.filters}:</span>
          {activePills.map((pill, idx) => (
            <div key={idx} className="flex items-center bg-white border border-gray-200 text-gray-800 text-sm font-medium px-3 py-1.5 rounded-full shadow-sm">
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
              className="text-sm font-semibold text-orange-500 hover:text-orange-600 ml-2"
            >
              {t.clearAll}
            </button>
          )}
        </div>
      )}

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
              className="mt-6 bg-black text-white px-6 py-2 rounded-full font-medium hover:bg-gray-800 transition"
            >
              {t.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 pb-20">
          {stalls.map(stall => (
            <StallCard key={stall.id} stall={stall} onClick={() => onStallClick(stall)} language={language} />
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
