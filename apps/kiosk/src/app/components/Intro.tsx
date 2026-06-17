import { CATEGORIES } from '../data';
import type { StallCategory } from '../data';
import { translations } from '../translations';
import { getHeroImage, getCategoryImage } from '../foodImages';
import { ImageWithFallback } from './ImageWithFallback';

interface IntroProps {
  activeCategory: StallCategory | null;
  onCategoryClick: (cat: StallCategory) => void;
  language: 'en' | 'ms' | 'zh';
}

export function Intro({ activeCategory, onCategoryClick, language }: IntroProps) {
  const t = translations[language];

  return (
    <div className="bg-[#FAF7F0] shrink-0 border-b border-[#EDE4D4]">
      {/* Hero / promo banner */}
      <div className="relative mx-3 mt-3 h-28 rounded-2xl overflow-hidden shadow-sm">
        <ImageWithFallback
          src={getHeroImage('kiosk-home')}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-5">
          <h1 className="text-white text-lg font-bold leading-tight max-w-[82%]">{t.appTitle}</h1>
          <p className="text-white/85 text-xs mt-1 max-w-[78%] line-clamp-2">{t.appDesc}</p>
        </div>
      </div>

      {/* Category Pills — horizontally scrollable, each with a food thumbnail */}
      <div className="w-full overflow-x-auto custom-scrollbar py-3">
        <div className="flex flex-nowrap gap-2 px-3 min-w-max">
          {CATEGORIES.map(category => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => onCategoryClick(category)}
                className={`flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border outline-none whitespace-nowrap
                  ${isActive
                    ? 'bg-[#E8622A] text-white border-[#E8622A] ring-2 ring-[#E8622A] ring-offset-1'
                    : 'bg-white text-[#1A1208] border-[#EDE4D4] hover:bg-[#E8622A]/10 hover:text-[#E8622A] hover:border-[#E8622A]'
                  }`}
              >
                <ImageWithFallback
                  src={getCategoryImage(category)}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover shrink-0 bg-white/30"
                />
                {category}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
