import { Delete } from 'lucide-react';
import { translations } from '../translations';

interface OnScreenKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
}

const ROWS = [
  '1234567890'.split(''),
  'qwertyuiop'.split(''),
  'asdfghjkl'.split(''),
  'zxcvbnm'.split(''),
];

export function OnScreenKeyboard({ value, onChange, onClose, language }: OnScreenKeyboardProps) {
  const t = translations[language];

  const press = (ch: string) => onChange(value + ch);
  const backspace = () => onChange(value.slice(0, -1));
  const clear = () => onChange('');

  return (
    <div className="absolute inset-x-0 bottom-0 z-[60] bg-[#F2ECE0] border-t border-[#EDE4D4] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] px-3 pt-2 pb-4 select-none kb-slide-up">
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[#C9BFB2]" />

      <div className="flex flex-col gap-1.5">
        {ROWS.map((row, i) => (
          <div key={i} className="flex justify-center gap-1.5">
            {row.map(ch => (
              <Key key={ch} onPress={() => press(ch)}>{ch}</Key>
            ))}
            {i === 3 && (
              <Key onPress={backspace} grow={1.6} ariaLabel="Backspace">
                <Delete className="w-5 h-5" />
              </Key>
            )}
          </div>
        ))}

        {/* Action row: clear · space · done */}
        <div className="flex justify-center gap-1.5 mt-0.5">
          <Key onPress={clear} grow={1.4}>{t.clearAll}</Key>
          <Key onPress={() => press(' ')} grow={4}>space</Key>
          <Key onPress={onClose} grow={1.4} accent>{t.done}</Key>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes kbSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .kb-slide-up { animation: kbSlideUp 0.22s cubic-bezier(0.22,1,0.36,1); }
      `}} />
    </div>
  );
}

function Key({
  children,
  onPress,
  grow = 1,
  accent,
  ariaLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  grow?: number;
  accent?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      // Keep the search input focused so physical typing can continue after a tap.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      style={{ flexGrow: grow, flexBasis: 0 }}
      className={`h-12 min-w-0 flex items-center justify-center rounded-xl text-lg font-semibold shadow-sm active:scale-95 transition-transform
        ${accent
          ? 'bg-[#E8622A] text-white'
          : 'bg-white text-[#1A1208] border border-[#EDE4D4] active:bg-[#FDF0E8]'}`}
    >
      {children}
    </button>
  );
}
