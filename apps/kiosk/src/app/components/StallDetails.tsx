import type { Stall } from '../data';
import { X, Map, Clock, Navigation } from 'lucide-react';
import { translations } from '../translations';

interface StallDetailsProps {
  stall: Stall;
  onClose: () => void;
  onNavigate: () => void;
  language: 'en' | 'ms' | 'zh';
}

export function StallDetails({ stall, onClose, onNavigate, language }: StallDetailsProps) {
  const t = translations[language];

  return (
    <div className="absolute inset-y-0 right-0 w-[480px] bg-white shadow-2xl flex flex-col z-40 transform transition-transform border-l border-gray-200">
      {/* Header Image */}
      <div className="relative h-56 shrink-0">
        <img src={stall.image} alt={stall.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h2 className="text-3xl font-bold mb-1 shadow-sm">{stall.name}</h2>
          <div className="flex items-center gap-4 text-sm font-medium opacity-90">
            <div className="flex items-center gap-1"><Map className="w-4 h-4" /> Zone {stall.zone}</div>
            <div className="flex items-center gap-1"><Navigation className="w-4 h-4" /> {stall.distance}m {t.away}</div>
            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> ~ {Math.ceil(stall.distance / 50)} min {t.walk}</div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-3 shrink-0">
        <button 
          onClick={onNavigate}
          className="flex-1 bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <Navigation className="w-5 h-5" />
          {t.navigateStall}
        </button>
      </div>

      {/* Menu List */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        <h3 className="font-bold text-lg mb-4 text-gray-900">
          {t.menu}
        </h3>
        <div className="space-y-4 pb-12">
          {stall.menu.map(item => (
            <div key={item.id} className="flex gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
              <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-gray-900 leading-tight">{item.name}</h4>
                  <span className="font-bold text-orange-600">{item.price}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500 font-medium">{item.calories}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider
                    ${item.nutritionLabel === 'Green' ? 'bg-green-100 text-green-700' : 
                      item.nutritionLabel === 'Orange' ? 'bg-orange-100 text-orange-700' : 
                      'bg-red-100 text-red-700'}
                  `}>
                    {item.nutritionLabel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
