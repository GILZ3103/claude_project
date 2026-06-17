import React, { useMemo, useState, useEffect } from 'react';
import { Search, Globe, X } from 'lucide-react';
import { translations } from '../translations';
import { MOCK_STALLS } from '../data';
import { ImageWithFallback } from './ImageWithFallback';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onLogoClick: () => void;
  onIconClick: (overlay: string) => void;
  language: 'en' | 'ms' | 'zh';
  isUserMode?: boolean;
  cardData?: { owner_name: string; points_balance: number } | null;
  faceDaemonOnline?: boolean;
}

export function Header({ searchQuery, setSearchQuery, onLogoClick, onIconClick, language, isUserMode, cardData, faceDaemonOnline }: HeaderProps) {
  const t = translations[language];
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search mock
  useEffect(() => {
    if (searchQuery) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return MOCK_STALLS.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.featuredFood.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery]);

  return (
    <header className="flex flex-col gap-3 px-4 py-3 bg-[#FAF7F0] border-b border-[#EDE4D4] shrink-0 z-50 relative">
      {/* Row 1: Logo + actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onLogoClick}
          className="text-xl font-bold text-[#E8622A] hover:text-[#E8622A]/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#E8622A] rounded px-1 shrink-0"
        >
          WarungTek
        </button>

        <div className="flex items-center gap-2">
          {/* Face daemon live indicator — shown when not logged in */}
          {faceDaemonOnline && !isUserMode && (
            <div className="flex items-center gap-1.5 bg-[#EAF4EC] border border-[#4A7C59]/30 rounded-full px-2.5 py-1">
              <div className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" />
              <span className="text-xs font-medium text-[#4A7C59]">Face scanning</span>
            </div>
          )}
          {isUserMode && cardData && (
            <div className="flex items-center gap-2 bg-[#FDF0E8] border border-[#E8622A]/30 rounded-full px-2.5 py-1" style={{ animation: 'headerUserIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
              <div className="w-6 h-6 bg-[#E8622A] rounded-full flex items-center justify-center text-white text-xs font-bold">
                {cardData.owner_name[0].toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-[#1A1208]">{cardData.owner_name}</span>
              <span className="text-xs text-[#E8622A] font-medium">{cardData.points_balance} pts</span>
            </div>
          )}
          <IconButton icon={<Globe className="w-5 h-5" />} onClick={() => onIconClick('language')} />
        </div>
      </div>

      {/* Row 2: Search (full width) */}
      <div className="relative w-full">
        <div className={`flex items-center bg-white border border-[#EDE4D4] rounded-full px-4 py-2 transition-colors ${isFocused ? 'ring-2 ring-[#E8622A]' : ''}`}>
          <Search className="w-5 h-5 text-gray-500 mr-2 shrink-0" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            className="bg-transparent border-none outline-none w-full text-black placeholder-gray-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="ml-2 text-gray-500 hover:text-black shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Dropdown */}
        {isFocused && searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500 animate-pulse">Loading...</div>
            ) : searchResults.length > 0 ? (
              <div className="py-2">
                {searchResults.map(stall => (
                  <button
                    key={stall.id}
                    onClick={() => {
                      setSearchQuery(stall.name);
                      setIsFocused(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <ImageWithFallback src={stall.image} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{stall.name}</div>
                      <div className="text-xs text-gray-500 truncate">{stall.category} • {stall.featuredFood}</div>
                    </div>
                    <div className="text-xs font-bold text-[#E8622A] bg-[#FDF0E8] px-2 py-1 rounded shrink-0">{stall.distance}m</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">{t.noResults}</div>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes headerUserIn {
          from { opacity: 0; transform: scale(0.8) translateX(12px); }
          to   { opacity: 1; transform: scale(1)   translateX(0); }
        }
      `}} />
    </header>
  );
}

function IconButton({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-full text-[#1A1208] hover:bg-[#E8622A] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#E8622A] focus:ring-offset-2"
    >
      {icon}
    </button>
  );
}
