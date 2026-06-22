import type { Stall } from '../data';
import { translations } from '../translations';
import { Star, MapPin, Ticket, Heart, Leaf, Clock } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

interface StallCardProps {
  stall: Stall;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  language: 'en' | 'ms' | 'zh';
}

export function StallCard({ stall, onClick, isFavorite, onToggleFavorite, language }: StallCardProps) {
  const t = translations[language];

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-[#EDE4D4] overflow-hidden cursor-pointer group hover:shadow-md transition-shadow relative"
      onClick={onClick}
    >
      <div className="relative h-44 overflow-hidden bg-gray-200">
        <ImageWithFallback
          src={stall.image}
          alt={stall.featuredFood}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badges on image */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {stall.isHealthy && (
            <div className="bg-[#EAF4EC] text-[#4A7C59] text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <Leaf className="w-3 h-3" /> {language === 'en' ? 'Healthy' : language === 'ms' ? 'Sihat' : '健康'}
            </div>
          )}
          {stall.hasVoucher && (
            <div className="bg-[#FDF0E8] text-[#E8622A] text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <Ticket className="w-3 h-3" /> {t.voucherAvail}
            </div>
          )}
        </div>

        {/* Favorite Icon — toggles a persisted favourite (stops the card's open-details click) */}
        <button
          aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={isFavorite}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm text-gray-500 hover:text-red-500 hover:bg-white active:scale-90 transition-all"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {stall.calories}
        </div>
      </div>

      <div className="p-3">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-base text-gray-900 leading-tight">{stall.name}</h3>
          <div className="flex items-center text-xs font-semibold text-amber-500">
            <Star className="w-3 h-3 fill-amber-500 mr-1" />
            {stall.rating}
          </div>
        </div>
        <p className="text-gray-600 text-xs font-medium mb-2">{stall.featuredFood}</p>

        <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium mt-auto">
          <div className="flex gap-2">
            <div className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              <span>{stall.distance}m</span>
            </div>
            <div className={`flex items-center gap-0.5 ${stall.operatingStatus === 'Currently Closed' ? 'text-red-500' : stall.operatingStatus === 'Closing Soon' ? 'text-orange-500' : 'text-[#4A7C59]'}`}>
              <Clock className="w-3 h-3" />
              <span>{stall.operatingStatus}</span>
            </div>
          </div>
          <div className="bg-[#FAF7F0] border border-[#EDE4D4] px-1.5 py-0.5 rounded text-[#8C7B6B]">
            {stall.category}
          </div>
        </div>
      </div>
    </div>
  );
}
