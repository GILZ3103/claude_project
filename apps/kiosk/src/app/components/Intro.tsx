import { CATEGORIES } from '../data';
import type { StallCategory } from '../data';
import { translations } from '../translations';

interface IntroProps {
  activeCategory: StallCategory | null;
  onCategoryClick: (cat: StallCategory) => void;
  language: 'en' | 'ms' | 'zh';
}

export function Intro({ activeCategory, onCategoryClick, language }: IntroProps) {
  const t = translations[language];

  return (
    <div className="flex flex-col items-center py-3 px-4 bg-[#F7F7F5] shrink-0 border-b border-gray-200">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t.appTitle}</h1>
      {/* Category Pills - horizontally scrollable if needed */}
      <div className="w-full max-w-5xl overflow-x-auto custom-scrollbar pb-1 mt-2">
        <div className="flex flex-nowrap justify-center gap-2 px-2 min-w-max">
          {CATEGORIES.map(category => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => onCategoryClick(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border outline-none whitespace-nowrap
                  ${isActive 
                    ? 'bg-black text-white border-black ring-2 ring-black ring-offset-1' 
                    : 'bg-white text-gray-800 border-gray-200 hover:bg-black hover:text-white hover:border-black'
                  }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
