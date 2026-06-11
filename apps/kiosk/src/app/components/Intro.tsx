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
    <div className="flex flex-col items-center py-3 px-4 bg-[#FAF7F0] shrink-0 border-b border-[#EDE4D4]">
      <h1 className="text-xl font-bold text-[#1A1208] mb-1">{t.appTitle}</h1>
      {/* Category Pills - horizontally scrollable if needed */}
      <div className="w-full max-w-5xl overflow-x-auto custom-scrollbar pb-1 mt-2">
        <div className="flex flex-nowrap justify-center gap-2 px-2 min-w-max">
          {CATEGORIES.map(category => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => onCategoryClick(category)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border outline-none whitespace-nowrap
                  ${isActive
                    ? 'bg-[#E8622A] text-white border-[#E8622A] ring-2 ring-[#E8622A] ring-offset-1'
                    : 'bg-white text-[#1A1208] border-[#EDE4D4] hover:bg-[#E8622A]/10 hover:text-[#E8622A] hover:border-[#E8622A]'
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
