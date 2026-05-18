import React, { useMemo, useState, useEffect } from 'react';
import { Search, Wallet, Ticket, Globe, HelpCircle, X, Settings } from 'lucide-react';
import { translations } from '../translations';
import { MOCK_STALLS } from '../data';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onLogoClick: () => void;
  onIconClick: (overlay: string) => void;
  language: 'en' | 'ms' | 'zh';
}

export function Header({ searchQuery, setSearchQuery, onLogoClick, onIconClick, language }: HeaderProps) {
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
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0 h-[72px] z-50 relative">
      {/* Left: Logo */}
      <button 
        onClick={onLogoClick}
        className="text-2xl font-bold text-orange-500 hover:text-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded px-2"
      >
        WarungTek
      </button>

      {/* Center: Search */}
      <div className="relative w-96">
        <div className={`flex items-center bg-gray-100 rounded-full px-4 py-2 transition-colors ${isFocused ? 'ring-2 ring-black bg-white' : ''}`}>
          <Search className="w-5 h-5 text-gray-500 mr-2" />
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
            <button onClick={() => setSearchQuery('')} className="ml-2 text-gray-500 hover:text-black">
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
                    <img src={stall.image} className="w-12 h-12 rounded-lg object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{stall.name}</div>
                      <div className="text-xs text-gray-500 truncate">{stall.category} • {stall.featuredFood}</div>
                    </div>
                    <div className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">{stall.distance}m</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">{t.noResults}</div>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2">
        <IconButton icon={<Settings className="w-5 h-5" />} onClick={() => onIconClick('settings')} />
        <IconButton icon={<Wallet className="w-5 h-5" />} onClick={() => onIconClick('nfc')} />
        <IconButton icon={<Ticket className="w-5 h-5" />} onClick={() => onIconClick('vouchers')} />
        <IconButton icon={<Globe className="w-5 h-5" />} onClick={() => onIconClick('language')} />
        <IconButton icon={<HelpCircle className="w-5 h-5" />} onClick={() => onIconClick('help')} />
      </div>
    </header>
  );
}

function IconButton({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-3 rounded-full text-black hover:bg-black hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
    >
      {icon}
    </button>
  );
}
