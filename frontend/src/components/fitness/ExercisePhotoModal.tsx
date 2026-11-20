import { useState, useEffect } from 'react';
import {
  X, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Dumbbell, Image as ImageIcon, Sparkles, Layers
} from 'lucide-react';
import { closeDialog, useDialog } from '../../hooks/useDialog';
import { useLanguage } from '../../context/LanguageContext';
import type { PhotoMuscle } from './data';
import { WORKOUT_GAMES_PHOTOS, PHOTO_MUSCLE_TABS, gameVariations } from './exercisePhotos';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialExerciseId?: string;
  initialMuscle?: PhotoMuscle;
}

export default function ExercisePhotoModal({
  isOpen,
  onClose,
  initialExerciseId,
  initialMuscle = 'chest',
}: Props) {
  const { lang, t } = useLanguage();
  const [selectedMuscle, setSelectedMuscle] = useState<PhotoMuscle>(initialMuscle);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    initialExerciseId || 'flat_bench'
  );

  useEffect(() => {
    if (initialExerciseId) {
      setSelectedExerciseId(initialExerciseId);
      const found = WORKOUT_GAMES_PHOTOS.find(e => e.id === initialExerciseId);
      if (found) {
        setSelectedMuscle(found.muscle);
      }
    } else if (initialMuscle) {
      setSelectedMuscle(initialMuscle);
      const firstInMuscle = WORKOUT_GAMES_PHOTOS.find(e => e.muscle === initialMuscle);
      if (firstInMuscle) setSelectedExerciseId(firstInMuscle.id);
    }
  }, [initialExerciseId, initialMuscle, isOpen]);

  const filteredExercises = WORKOUT_GAMES_PHOTOS.filter(e => e.muscle === selectedMuscle);
  const activeExercise =
    WORKOUT_GAMES_PHOTOS.find(e => e.id === selectedExerciseId) ||
    filteredExercises[0] ||
    WORKOUT_GAMES_PHOTOS[0]!;

  // The variation shown within the game; it goes back to the first one when the game changes.
  const [shownVariation, setShownVariation] = useState({ id: '', index: 0 });
  const variations = gameVariations(activeExercise);
  const variationIndex = shownVariation.id === activeExercise.id ? shownVariation.index : 0;
  const activeVariation = variations[variationIndex] ?? variations[0]!;
  const showVariation = (index: number) =>
    setShownVariation({ id: activeExercise.id, index: (index + variations.length) % variations.length });

  const handleMuscleChange = (muscle: PhotoMuscle) => {
    setSelectedMuscle(muscle);
    const firstInMuscle = WORKOUT_GAMES_PHOTOS.find(e => e.muscle === muscle);
    if (firstInMuscle) setSelectedExerciseId(firstInMuscle.id);
  };

  const handleNext = () => {
    const currentIndex = WORKOUT_GAMES_PHOTOS.findIndex(e => e.id === activeExercise.id);
    const nextIndex = (currentIndex + 1) % WORKOUT_GAMES_PHOTOS.length;
    const nextExercise = WORKOUT_GAMES_PHOTOS[nextIndex]!;
    setSelectedMuscle(nextExercise.muscle);
    setSelectedExerciseId(nextExercise.id);
  };

  const handlePrev = () => {
    const currentIndex = WORKOUT_GAMES_PHOTOS.findIndex(e => e.id === activeExercise.id);
    const prevIndex = (currentIndex - 1 + WORKOUT_GAMES_PHOTOS.length) % WORKOUT_GAMES_PHOTOS.length;
    const prevExercise = WORKOUT_GAMES_PHOTOS[prevIndex]!;
    setSelectedMuscle(prevExercise.muscle);
    setSelectedExerciseId(prevExercise.id);
  };

  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs" onClick={() => closeDialog(dialogRef.current, onClose)} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-modal-title"
        className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[94dvh] flex flex-col z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-400/30">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 id="photo-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>{t('Workout Game Photo & Form Guide')}</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {lang === 'ur' ? activeExercise.muscleUrdu : activeExercise.muscleLabel}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {t('The real exercise photo and an easy way to do it')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeDialog(dialogRef.current, onClose)}
            aria-label={t('Close')}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Top Muscle Group Selector */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            {PHOTO_MUSCLE_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleMuscleChange(tab.key)}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition text-center ${
                  selectedMuscle === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60'
                }`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>

          {/* Exercise Quick Pills in this Muscle */}
          <div className="flex flex-wrap gap-1.5">
            {filteredExercises.map(ex => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setSelectedExerciseId(ex.id)}
                className={`py-1 pl-1 pr-3 rounded-full text-xs font-bold border transition flex items-center gap-1.5 ${
                  selectedExerciseId === ex.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:border-gray-300'
                }`}
              >
                <img src={ex.image} alt="" loading="lazy" className="w-5 h-5 rounded-full object-cover bg-white shrink-0" />
                <span>{t(ex.name)}</span>
              </button>
            ))}
          </div>

          {/* MAIN PHOTO DISPLAY CARD: the variation's start and end photo side by side */}
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 shadow-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <div className="min-w-0">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-blue-400 truncate">
                  {t('Game:')} {t(activeExercise.name)}
                </span>
                <h3 className="text-sm sm:text-base font-black text-white truncate">{t(activeVariation.name)}</h3>
              </div>
              <span className="shrink-0 bg-emerald-600/90 text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5">
                <Dumbbell size={13} />
                <span>{t(activeExercise.sets)} · {t(activeExercise.reps)}</span>
              </span>
            </div>

            <div className="relative p-3">
              <div
                key={`${activeExercise.id}:${activeVariation.name}`}
                className={`relative grid gap-3 animate-fade-in ${activeVariation.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
              >
                {activeVariation.photos.length > 1 && (
                  <span
                    className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 ring-slate-900 shadow-lg"
                    aria-hidden="true"
                  >
                    <ChevronRight size={20} />
                  </span>
                )}
                {activeVariation.photos.map((p, i) => (
                  <figure
                    key={p.src}
                    className={`relative rounded-xl overflow-hidden ${p.phase ? 'bg-white' : 'bg-slate-950'}`}
                  >
                    <img
                      src={p.src}
                      alt={p.phase ? `${t(activeVariation.name)} · ${t(p.phase)}` : t(activeExercise.name)}
                      className={`w-full object-contain select-none ${p.phase ? 'aspect-[4/3]' : 'h-64 sm:h-[400px]'}`}
                      loading="eager"
                    />
                    {p.phase && (
                      <figcaption className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-lg bg-black/75 text-white backdrop-blur-xs">
                        <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-black">{i + 1}</span>
                        {t(p.phase)}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>

              {variations.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => showVariation(variationIndex - 1)}
                    aria-label={t('Previous Variation')}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/70 hover:bg-blue-600 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => showVariation(variationIndex + 1)}
                    aria-label={t('Next Variation')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/70 hover:bg-blue-600 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 transition shadow-lg"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-4 pb-3 text-[11px] text-slate-300">
              <span className="font-bold text-white shrink-0">
                {t('Variation {n} of {total}', { n: variationIndex + 1, total: variations.length })}
              </span>
              <span className="truncate">{t('Target: {area}', { area: t(activeExercise.targetArea) })}</span>
            </div>
          </div>

          {/* Every variation of this game, each one separate */}
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-700 dark:text-slate-300 mb-2">
              <Layers size={14} className="text-blue-600 dark:text-blue-400" />
              {t('Variations ({count})', { count: variations.length })}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {variations.map((v, i) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => showVariation(i)}
                  aria-pressed={i === variationIndex}
                  className={`group text-left rounded-xl overflow-hidden border-2 bg-white dark:bg-slate-800 transition ${
                    i === variationIndex
                      ? 'border-blue-600 shadow-md shadow-blue-500/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  <div className={`relative aspect-[4/3] bg-white overflow-hidden grid ${v.photos.length > 1 ? 'grid-cols-2 gap-px bg-gray-200' : ''}`}>
                    {v.photos.map(p => (
                      <img
                        key={p.src}
                        src={p.src}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover bg-white select-none group-hover:scale-105 transition duration-300"
                      />
                    ))}
                    {v.photos.length > 1 && (
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-2 ring-white" aria-hidden="true">
                        <ChevronRight size={12} />
                      </span>
                    )}
                    <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center ${
                      i === variationIndex ? 'bg-blue-600' : 'bg-black/70'
                    }`}>
                      {i + 1}
                    </span>
                  </div>
                  <span className="block px-2 py-1.5 text-[11px] font-bold leading-tight text-gray-800 dark:text-slate-200 line-clamp-2">
                    {t(v.name)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* HOW TO PERFORM GUIDE */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-xs text-blue-950 dark:text-blue-200 space-y-1">
            <strong className="block font-black text-sm text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
              {t('How to Do It (Simple Instructions):')}
            </strong>
            <p className="leading-relaxed font-medium">
              {lang === 'ur' ? activeExercise.howToUrdu : activeExercise.howTo}
            </p>
          </div>

          {/* Sahi vs Ghalat Form Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Sahi Form */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-950 dark:text-emerald-200 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide border-b border-emerald-500/20 pb-1.5">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{t('Correct Form ✅')}</span>
              </div>
              <ul className="space-y-1.5 font-medium">
                {activeExercise.goodFormTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-black shrink-0">✓</span>
                    <span>{t(tip)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ghalat Form */}
            <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-950 dark:text-rose-200 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-rose-800 dark:text-rose-300 uppercase tracking-wide border-b border-rose-500/20 pb-1.5">
                <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{t('Mistakes (Avoid These ❌)')}</span>
              </div>
              <ul className="space-y-1.5 font-medium">
                {activeExercise.mistakesToAvoid.map((mistake, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-600 font-black shrink-0">✗</span>
                    <span>{t(mistake)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer with Quick Switch and Close */}
        <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-900/80 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold hover:bg-gray-100 transition flex items-center gap-1 text-gray-700 dark:text-slate-300"
            >
              <ChevronLeft size={14} />
              <span>{t('Previous Game')}</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold hover:bg-gray-100 transition flex items-center gap-1 text-gray-700 dark:text-slate-300"
            >
              <span>{t('Next Game')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => closeDialog(dialogRef.current, onClose)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            {t('Close Photo')}
          </button>
        </div>
      </div>
    </div>
  );
}
