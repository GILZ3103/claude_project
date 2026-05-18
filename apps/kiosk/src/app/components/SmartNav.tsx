import React, { useState } from 'react';
import { X, Navigation, MapPin, Footprints, ZoomIn, ZoomOut } from 'lucide-react';
import type { Stall } from '../data';
import { MOCK_STALLS } from '../data';
import { translations } from '../translations';

interface SmartNavProps {
  destination: Stall | null;
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
}

export function SmartNav({ destination, onClose, language }: SmartNavProps) {
  const t = translations[language];
  const [scale, setScale] = useState(1);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-full max-h-[520px] flex overflow-hidden shadow-2xl relative">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md text-gray-500 hover:text-black hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Map Area */}
        <div className="flex-1 bg-gray-100 relative p-8 flex items-center justify-center overflow-hidden">
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
            <button onClick={handleZoomIn} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-black hover:bg-gray-50"><ZoomIn className="w-5 h-5"/></button>
            <button onClick={handleZoomOut} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-black hover:bg-gray-50"><ZoomOut className="w-5 h-5"/></button>
          </div>

          <div 
            className="relative bg-white border-2 border-gray-200 rounded-xl shadow-inner transition-transform duration-300 ease-out p-6 flex flex-col gap-4"
            style={{ 
              transform: `scale(${scale})`, 
              width: '600px', 
              height: '460px'
            }}
          >
            {/* Zones Grid */}
            {[['A1', 'A2', 'A3'], ['B1', 'B2', 'B3'], ['C1', 'C2', 'C3']].map((row, rIdx) => (
              <React.Fragment key={`row-${rIdx}`}>
                <div className="flex gap-4 justify-between h-24">
                  {row.map((zone) => {
                    const stallInZone = MOCK_STALLS.find(s => s.zone === zone);
                    const isDest = destination?.zone === zone;

                    return (
                      <div key={zone} className={`flex-1 flex items-center justify-center rounded-lg border-2 relative overflow-hidden transition-all
                        ${isDest 
                          ? 'border-orange-500 bg-orange-100 shadow-[0_0_20px_rgba(249,115,22,0.6)] z-20 scale-105' 
                          : stallInZone 
                            ? 'border-gray-300 bg-gray-50 opacity-60' 
                            : 'border-dashed border-gray-200 bg-transparent'
                        }
                      `}>
                        {stallInZone ? (
                          <>
                            <img src={stallInZone.image} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                            <div className={`absolute inset-0 ${isDest ? 'bg-orange-900/40' : 'bg-black/20'}`}></div>
                            <div className="relative z-10 flex flex-col items-center p-2 text-center">
                              {isDest && <MapPin className="w-6 h-6 text-white fill-orange-500 drop-shadow-md mb-1 animate-bounce" />}
                              <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-sm leading-tight
                                ${isDest ? 'bg-orange-600' : 'bg-gray-800'}
                              `}>
                                {stallInZone.name}
                              </span>
                              <span className="text-[8px] font-bold text-white/80 mt-0.5">{zone}</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-300 font-medium text-xs">{zone} (Empty)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Walking Path Divider */}
                {rIdx < 2 && (
                  <div className="h-6 w-full flex items-center justify-center relative z-10">
                    <div className="w-full h-full bg-gray-100/80 rounded border border-gray-200/50 flex items-center justify-evenly overflow-hidden">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="w-4 h-1.5 bg-gray-300 rounded-full"></div>
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}

            {/* Navigation Path Mock using SVG overlay */}
            {destination && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 15 }}>
                <path 
                  d="M 300 440 L 300 300 L 100 300 L 100 160" 
                  fill="none" 
                  stroke="#F97316" 
                  strokeWidth="6" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="animate-[dash_2s_linear_infinite]"
                  strokeDasharray="10 10"
                />
              </svg>
            )}

            {/* You Are Here */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-30">
              <div className="w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-md animate-pulse" />
              <span className="text-[10px] font-bold mt-1 text-blue-700 bg-white px-3 py-1 rounded-full shadow-md border border-blue-100">{t.youAreHere}</span>
            </div>
          </div>
        </div>

        {/* Right: Directions Panel */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t.directions}
          </h2>
          
          {destination ? (
            <>
              <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
                <h3 className="font-bold text-orange-800 mb-1">{destination.name}</h3>
                <p className="text-sm text-orange-600 font-medium">Zone {destination.zone} • {destination.category}</p>
                
                <div className="flex items-center gap-4 mt-3 text-sm font-semibold text-orange-700">
                  <div className="flex items-center gap-1"><Navigation className="w-4 h-4" /> {destination.distance}m</div>
                  <div className="flex items-center gap-1"><Footprints className="w-4 h-4" /> ~ {Math.ceil(destination.distance / 50)} min</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-6">
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    <p className="font-bold text-gray-900 text-sm">{t.startKiosk}</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white" />
                    <p className="font-bold text-gray-900 text-sm">{t.goStraight}</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white" />
                    <p className="font-bold text-gray-900 text-sm">{t.turnLeft}</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                    <p className="font-bold text-orange-600 text-sm">{t.arriveAt} {destination.name}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-center">
              {t.selectDestToView}
            </div>
          )}

          <button 
            onClick={onClose}
            className="w-full mt-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t.done}
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
      `}} />
    </div>
  );
}
