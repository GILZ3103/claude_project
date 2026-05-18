import { useState } from 'react';
import { Settings, X, LogOut, CheckCircle, Loader2 } from 'lucide-react';
import { translations } from '../translations';

interface SettingsModalProps {
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
  isUserMode: boolean;
  onLogout: () => void;
  globalPreferences: {
    vegetarian: boolean;
    halal: boolean;
    lowSugar: boolean;
    seafoodFree: boolean;
  };
  setGlobalPreferences: React.Dispatch<React.SetStateAction<{
    vegetarian: boolean;
    halal: boolean;
    lowSugar: boolean;
    seafoodFree: boolean;
  }>>;
  globalCalorieTarget: number;
  setGlobalCalorieTarget: React.Dispatch<React.SetStateAction<number>>;
}

export function SettingsModal({ 
  onClose, language, isUserMode, onLogout,
  globalPreferences, setGlobalPreferences, globalCalorieTarget, setGlobalCalorieTarget
}: SettingsModalProps) {
  const t = translations[language];
  const [calorieIntake, setCalorieIntake] = useState(globalCalorieTarget);
  const [preferences, setPreferences] = useState(globalPreferences);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const togglePref = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setGlobalPreferences(preferences);
      setGlobalCalorieTarget(calorieIntake);
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 800);
  };

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end transition-opacity">
      <div className="w-[400px] h-full bg-white shadow-2xl flex flex-col animate-[slideInRight_0.3s_ease-out]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            {t.settings}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {showSuccess && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 animate-[pulse_2s_ease-in-out]">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span className="font-bold text-green-800 text-sm">Changes Saved Successfully</span>
            </div>
          )}

          {/* Calorie Goal */}
          <section>
            <h3 className="font-bold text-gray-900 mb-4">{t.dailyCalorieIntake}</h3>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="flex justify-between items-end mb-4">
                <span className="text-sm text-gray-600">{t.target}</span>
                <span className="font-bold text-orange-600 text-xl">{calorieIntake} kcal</span>
              </div>
              <input 
                type="range" 
                min="1200" 
                max="3500" 
                step="100" 
                value={calorieIntake}
                onChange={(e) => setCalorieIntake(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>
          </section>

          {/* Dietary Restrictions */}
          <section>
            <h3 className="font-bold text-gray-900 mb-4">{t.foodRestrictions}</h3>
            <div className="space-y-3">
              <ToggleItem label={t.halal} active={preferences.halal} onClick={() => togglePref('halal')} />
              <ToggleItem label={t.vegetarian} active={preferences.vegetarian} onClick={() => togglePref('vegetarian')} />
              <ToggleItem label={t.lowSugar} active={preferences.lowSugar} onClick={() => togglePref('lowSugar')} />
              <ToggleItem label={t.seafoodFree} active={preferences.seafoodFree} onClick={() => togglePref('seafoodFree')} />
            </div>
          </section>
          
        </div>

        <div className="p-6 border-t border-gray-100 bg-white flex flex-col gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
              isSaving ? 'bg-orange-300 text-white cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/30'
            }`}
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          
          {isUserMode && (
            <button 
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {t.logout}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-gray-200 transition-colors shadow-sm"
      onClick={onClick}
    >
      <span className="font-medium text-gray-800">{label}</span>
      <div className={`w-12 h-6 rounded-full transition-colors relative ${active ? 'bg-orange-500' : 'bg-gray-200'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${active ? 'left-7' : 'left-1'}`} />
      </div>
    </div>
  );
}