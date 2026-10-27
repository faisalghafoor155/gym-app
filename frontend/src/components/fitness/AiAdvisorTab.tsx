import { Sparkles, Copy, Check, Zap, Bot, AlertCircle, Send, HelpCircle, CheckCircle2, Key, Trash2 } from 'lucide-react';
import { Card, inputClass, Spinner } from '../ui';
import FormattedAiResponse from './FormattedAiResponse';
import { useLanguage } from '../../context/LanguageContext';
import type { Goal, AiAnswer, MacroResult, GainerProfile, AiDietGuidance } from './data';

interface AiAdvisorTabProps {
  weightKg: number;
  goal: Goal;
  userQuery: string;
  setUserQuery: React.Dispatch<React.SetStateAction<string>>;
  loadingAi: boolean;
  copiedAnswerIdx: number | null;
  setShowApiKeyModal: React.Dispatch<React.SetStateAction<boolean>>;
  customApiKey: string;
  setTempApiKey: React.Dispatch<React.SetStateAction<string>>;
  aiAnswers: AiAnswer[];
  macros: MacroResult;
  gainer: GainerProfile;
  aiGuidance: AiDietGuidance;
  QUICK_PROMPTS: Array<{ label: string; prompt: string }>;
  handleAskAi: (e?: React.FormEvent, customQuestion?: string) => Promise<void>;
  handleCopyAnswer: (text: string, idx: number) => void;
  handleClearAiChat: () => void;
}

export default function AiAdvisorTab({
  weightKg,
  goal,
  userQuery,
  setUserQuery,
  loadingAi,
  copiedAnswerIdx,
  setShowApiKeyModal,
  customApiKey,
  setTempApiKey,
  aiAnswers,
  macros,
  gainer,
  aiGuidance,
  QUICK_PROMPTS,
  handleAskAi,
  handleCopyAnswer,
  handleClearAiChat,
}: AiAdvisorTabProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      {/* Top AI Summary Header */}
      <Card className="p-6 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white border-purple-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 text-purple-300 shadow-inner">
              <Bot size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={14} /> {t('AI Nutrition & Diet Advisor')}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  {t('⚡ Live Engine')}
                </span>
              </div>
              <h2 className="text-xl font-black mt-1">
                {t('Custom Plan For: {weight} kg Lifter ({goal})', { weight: weightKg, goal: goal.replace('_', ' ').toUpperCase() })}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {aiGuidance.strategy}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center">
              <span className="text-[10px] text-purple-300 uppercase block font-semibold">{t('Target Calories')}</span>
              <span className="text-base font-black text-white">{macros.targetCalories} kcal</span>
            </div>
            <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center">
              <span className="text-[10px] text-purple-300 uppercase block font-semibold">{t('Required Protein')}</span>
              <span className="text-base font-black text-rose-300">{macros.proteinGrams}g</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTempApiKey(customApiKey);
                setShowApiKeyModal(true);
              }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-purple-200 border border-white/10 transition text-xs flex items-center gap-1.5"
              title={t('Configure Gemini API Key')}
            >
              <Key size={14} />
              <span className="hidden sm:inline">{customApiKey ? t('Custom Key Set') : t('AI Settings')}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* AI Core Guidance Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kya Kya Lena Chaiye (What to eat) */}
        <Card className="p-5 border-t-4 border-t-emerald-500 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            {t('What to Eat (Recommended Diet Items)')}
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                {t('🌅 Breakfast:')}
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                {aiGuidance.morningMeal}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                {t('☀️ Lunch:')}
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                {aiGuidance.lunchMeal}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                {t('⚡ Workout Fuel (Pre & Post Workout):')}
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                <strong>{t('Pre:')}</strong> {aiGuidance.preWorkout} <br />
                <strong>{t('Post:')}</strong> {aiGuidance.postWorkout}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                {t('🌙 Dinner:')}
              </strong>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                {aiGuidance.dinnerMeal}
              </p>
            </div>
          </div>
        </Card>

        {/* Supplements & Dos/Don'ts */}
        <div className="space-y-6">
          {/* Supplements Advice */}
          <Card className="p-5 border-t-4 border-t-blue-500 space-y-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Zap size={18} className="text-blue-600 dark:text-blue-400" />
              {t('Supplements: Which Ones Do You Need?')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t('AI Analysis: Food always comes first. Take the supplements below only when you need them:')}
            </p>

            <ul className="space-y-2 text-xs">
              {aiGuidance.supplements.map((s, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Avoid List */}
          <Card className="p-5 border-t-4 border-t-rose-500 space-y-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 dark:text-rose-400" />
              {t('What Not to Eat (Avoid List)')}
            </h3>

            <ul className="space-y-2 text-xs">
              {aiGuidance.avoidList.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                  <span className="text-rose-600 font-bold">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Interactive Ask AI Section */}
      <Card className="p-5 sm:p-6 space-y-4 border-purple-200 dark:border-purple-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                {t('GymPro AI Fitness & Nutrition Chatbot')}
                <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full">
                  {t('Interactive')}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('You can ask any question about diet, mass gainers, pre-workout, creatine, fat loss or exercises:')}
              </p>
            </div>
          </div>

          {aiAnswers.length > 0 && (
            <button
              type="button"
              onClick={handleClearAiChat}
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-xs flex items-center gap-1"
              title={t('Clear Chat History')}
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline text-[11px]">{t('Clear')}</span>
            </button>
          )}
        </div>

        {/* Quick Prompt Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loadingAi}
              onClick={() => void handleAskAi(undefined, p.prompt)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 hover:border-purple-300 dark:hover:bg-purple-900/40 transition disabled:opacity-50 text-left"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chat Input Form */}
        <form onSubmit={e => void handleAskAi(e)} className="flex gap-2">
          <input
            type="text"
            value={userQuery}
            onChange={e => setUserQuery(e.target.value)}
            disabled={loadingAi}
            placeholder={t('e.g. Is it OK to take pre-workout with Anabolic Mass? Or how many chest sets should I do?')}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={!userQuery.trim() || loadingAi}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition flex items-center gap-1.5 shrink-0 shadow-md shadow-purple-600/30"
          >
            {loadingAi ? <Spinner className="w-4 h-4 text-white" /> : <Send size={14} />}
            <span>{loadingAi ? t('Thinking...') : t('Ask AI')}</span>
          </button>
        </form>

        {/* Loading Indicator */}
        {loadingAi && (
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex items-center gap-3 animate-pulse">
            <Spinner className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div className="text-xs text-purple-900 dark:text-purple-200">
              <strong className="block font-bold">{t('GymPro AI is analyzing your stats & formulating recommendations...')}</strong>
              <span className="text-[11px] text-purple-700 dark:text-purple-300">
                {t('Profile: {weight}kg | {goal} | {gainer}', { weight: weightKg, goal: goal.replace('_', ' '), gainer: t(gainer.name) })}
              </span>
            </div>
          </div>
        )}

        {/* Answers Feed */}
        <div className="space-y-3 pt-2">
          {aiAnswers.map((item, idx) => (
            <div key={idx} className="p-4 sm:p-5 rounded-xl bg-gray-50 dark:bg-slate-800/70 border border-gray-100 dark:border-slate-800 space-y-2.5 shadow-xs">
              <div className="flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2 font-bold text-gray-900 dark:text-slate-100">
                  <HelpCircle size={15} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <span>{t(item.question)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/20 px-2 py-0.5 rounded-full">
                    {t(item.tag)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyAnswer(t(item.answer), idx)}
                    title={t('Copy advice')}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded transition"
                  >
                    {copiedAnswerIdx === idx ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="pl-3 sm:pl-5 border-l-2 border-purple-500/40">
                <FormattedAiResponse content={t(item.answer)} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
