import { CATEGORIES } from '../data';
import { translations } from '../translations';

export interface FilterState {
  category: string | null;
  calories: string | null;
  dietary: string[];
  vendorType: string[];
  distance: string[];
  voucher: string | null;
  availability: string[];
}

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  language: 'en' | 'ms' | 'zh';
  isUserMode: boolean;
}

export function FilterPanel({ filters, setFilters, language, isUserMode }: FilterPanelProps) {
  const t = translations[language];

  const updateRadio = (group: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [group]: prev[group] === value ? null : value
    }));
  };

  const updateCheckbox = (group: keyof FilterState, value: string) => {
    setFilters(prev => {
      const current = prev[group] as string[];
      if (current.includes(value)) {
        return { ...prev, [group]: current.filter(v => v !== value) };
      }
      return { ...prev, [group]: [...current, value] };
    });
  };

  const RadioGroup = ({ title, group, options }: { title: string, group: keyof FilterState, options: {label: string, value: string}[] }) => (
    <div className="mb-6">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider">{title}</h3>
      <div className="space-y-3">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center space-x-3 cursor-pointer group touch-manipulation">
            <input type="radio" className="hidden" checked={filters[group] === opt.value} onChange={() => updateRadio(group, opt.value)} />
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0
              ${filters[group] === opt.value ? 'border-black' : 'border-gray-300 group-hover:border-black'}
            `}>
              {filters[group] === opt.value && <div className="w-3 h-3 rounded-full bg-black" />}
            </div>
            <span className="text-gray-800 font-medium select-none leading-tight">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const CheckboxGroup = ({ title, group, options }: { title: string, group: keyof FilterState, options: {label: string, value: string}[] }) => (
    <div className="mb-6">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider">{title}</h3>
      <div className="space-y-3">
        {options.map(opt => {
          const isChecked = (filters[group] as string[]).includes(opt.value);
          return (
            <label key={opt.value} className="flex items-center space-x-3 cursor-pointer group touch-manipulation">
              <input type="checkbox" className="hidden" checked={isChecked} onChange={() => updateCheckbox(group, opt.value)} />
              <div className={`w-8 h-8 rounded border-2 flex items-center justify-center transition-colors shrink-0
                ${isChecked ? 'bg-black border-black text-white' : 'bg-white border-gray-300 group-hover:border-black'}
              `}>
                {isChecked && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-gray-800 font-medium select-none leading-tight">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  const catOptions = CATEGORIES.map(c => ({ label: c, value: c }));

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-[#F7F7F5] h-full overflow-y-auto overflow-x-hidden p-6 custom-scrollbar">
      <h2 className="text-xl font-bold mb-6 text-black">{t.filters}</h2>

      <RadioGroup title={t.foodCategory} group="category" options={catOptions} />
      
      {isUserMode && (
        <>
          <RadioGroup title={t.calories} group="calories" options={[
            {label: t.under300, value: 'Under 300 kcal'}, 
            {label: t.under500, value: 'Under 500 kcal'}
          ]} />
          <CheckboxGroup title={t.dietary} group="dietary" options={[
            {label: t.highProtein, value: 'High Protein'},
            {label: t.lowSugar, value: 'Low Sugar'},
            {label: t.vegetarian, value: 'Vegetarian'}
          ]} />
        </>
      )}

      <CheckboxGroup title="Vendor Type" group="vendorType" options={[
        {label: t.halal, value: 'Halal'}, 
        {label: t.vegetarian, value: 'Vegetarian'}, 
        {label: t.localVendors, value: 'Local Vendors'}, 
        {label: t.popularVendors, value: 'Popular Vendors'}
      ]} />
      <CheckboxGroup title={t.distance} group="distance" options={[
        {label: t.nearest, value: 'Nearest'}, 
        {label: t.mediumDistance, value: 'Medium'}, 
        {label: t.furthest, value: 'Furthest'}
      ]} />
      <RadioGroup title={t.vouchers} group="voucher" options={[
        {label: t.voucherAvail, value: 'Voucher Available'}
      ]} />
      <CheckboxGroup title={t.availability} group="availability" options={[
        {label: t.openNow, value: 'Open Now'}, 
        {label: t.closingSoon, value: 'Closing Soon'}, 
        {label: t.closed, value: 'Currently Closed'}
      ]} />
    </div>
  );
}
