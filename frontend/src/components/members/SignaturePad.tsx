import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Eraser } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

/**
 * A box to sign in with a finger, a stylus or a mouse.
 *
 * Draws in black on white whatever the theme, because the PNG it hands back is
 * a printed record, and trims nothing: the image is small at this size.
 * `onChange` gets the data URL after each stroke, or null when cleared.
 */
export default function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const { t } = useLanguage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  // Sized to its box once, at twice the pixels so the line is not blurry.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * 2);
    c.height = Math.round(height * 2);
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext('2d')!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A dot for a tap, so a single touch still leaves a mark.
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    onChange(canvas.current!.toDataURL('image/png'));
  };

  const clear = () => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 overflow-hidden bg-white">
        <canvas
          ref={canvas}
          aria-label={t('Signature')}
          className="block w-full h-36 touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-gray-400">
            {t('Sign here')}
          </span>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:text-slate-400">
        <Eraser size={12} /> {t('Clear')}
      </button>
    </div>
  );
}
