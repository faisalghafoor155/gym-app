import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { Trash2, Upload, Building2 } from 'lucide-react';
import { Card, FieldLabel, inputClass, primaryButton } from '../ui';
import { useLanguage } from '../../context/LanguageContext';
import type { GymProfile, PaymentAccounts } from './types';

export default function GymSettingsCard({
  profile, setProfile, handleLogoChange, handleRemoveLogo,
  joiningFeeInput, setJoiningFeeInput, ptFeeInput, setPtFeeInput, retention, setRetention,
  accounts, setAccounts, savingSettings, handleSettingsSave,
}: {
  profile: GymProfile;
  setProfile: Dispatch<SetStateAction<GymProfile>>;
  handleLogoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveLogo: () => void;
  joiningFeeInput: string;
  setJoiningFeeInput: (v: string) => void;
  ptFeeInput: string;
  setPtFeeInput: (v: string) => void;
  retention: { referralRewardDays: string; inactivityDays: string };
  setRetention: Dispatch<SetStateAction<{ referralRewardDays: string; inactivityDays: string }>>;
  accounts: PaymentAccounts;
  setAccounts: Dispatch<SetStateAction<PaymentAccounts>>;
  savingSettings: boolean;
  handleSettingsSave: (e: FormEvent) => void | Promise<void>;
}) {
  const { t } = useLanguage();
  return (
    <Card className="p-5 mb-5">
      <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">{t('Gym settings')}</h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        {t('What members see on a receipt, pricing, and the accounts they send money to.')}
      </p>
      <form onSubmit={handleSettingsSave} className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            {t('Gym details')}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            {t('Printed at the top of every receipt a member keeps.')}
          </p>
          <div className="mb-4 p-4 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/20 dark:ring-white/10 overflow-hidden">
              {profile.logo ? (
                <img src={profile.logo} alt={t('Gym Logo')} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="text-white/80" size={32} />
              )}
            </div>
            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">{t('Gym Brand Logo')}</p>
                {profile.logo && (
                  <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">{t('Custom Logo Set')}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('Appears in the desktop sidebar, mobile header, and receipts. PNG, JPG, or SVG up to 2MB.')}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors">
                  <Upload size={13} />
                  <span>{profile.logo ? t('Change Logo') : t('Upload Logo')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
                {profile.logo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>{t('Remove')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="gym-name">{t('Gym name')}</FieldLabel>
              <input
                id="gym-name"
                required
                maxLength={100}
                value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="gym-owner">{t('Owner name')}</FieldLabel>
              <input
                id="gym-owner"
                required
                maxLength={100}
                value={profile.ownerName}
                onChange={e => setProfile(p => ({ ...p, ownerName: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="gym-phone">{t('Phone')}</FieldLabel>
              <input
                id="gym-phone"
                type="tel"
                inputMode="tel"
                maxLength={30}
                placeholder="0300-1234567"
                value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="gym-address">{t('Address')}</FieldLabel>
              <textarea
                id="gym-address"
                rows={2}
                maxLength={300}
                placeholder="Shop 4, Al-Rehman Plaza, Peshawar Road, Rawalpindi"
                value={profile.address}
                onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
            {t('Leave the phone or address blank and the receipt simply leaves that line out.')}
          </p>
        </div>

        <div className="max-w-xs border-t border-gray-100 dark:border-slate-800 pt-4">
          <label htmlFor="joining-fee" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            {t('Fixed joining fee (Rs.)')}
          </label>
          <input
            id="joining-fee"
            type="number"
            min="0"
            step="1"
            value={joiningFeeInput}
            onChange={e => setJoiningFeeInput(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            {t('Filled in automatically on every new member, e.g. 3000. The desk can still change it for one member. Set it to 0 for no fixed fee.')}
          </p>
        </div>

        <div className="max-w-xs border-t border-gray-100 dark:border-slate-800 pt-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            {t('Default trainer assignment fee (Rs.)')}
          </label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={ptFeeInput}
            onChange={e => setPtFeeInput(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            {t('Charged once when a member is put with a personal trainer. A trainer with their own fee set overrides this. Set it to 0 to charge nothing.')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 max-w-xl border-t border-gray-100 dark:border-slate-800 pt-4">
          <div>
            <label htmlFor="referral-days" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t('Referral reward (free days)')}
            </label>
            <input
              id="referral-days"
              type="number"
              min="0"
              max="90"
              step="1"
              value={retention.referralRewardDays}
              onChange={e => setRetention(r => ({ ...r, referralRewardDays: e.target.value }))}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
              {t("Added to a member's membership for each friend they bring in, when you give the reward on the Referrals page. 0 to reward another way.")}
            </p>
          </div>
          <div>
            <label htmlFor="inactivity-days" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t('Inactive after (days without a visit)')}
            </label>
            <input
              id="inactivity-days"
              type="number"
              min="3"
              max="90"
              step="1"
              value={retention.inactivityDays}
              onChange={e => setRetention(r => ({ ...r, inactivityDays: e.target.value }))}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
              {t('Members with a running membership who have not checked in for this long show on the Inactive Members list.')}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            {t('Payment accounts')}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            {t('Shown to the front desk when a member pays online, so they can say where to send it. Leave blank for any channel you do not use.')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="acct-easypaisa" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Easypaisa
              </label>
              <input
                id="acct-easypaisa"
                inputMode="tel"
                maxLength={200}
                value={accounts.easypaisa}
                onChange={e => setAccounts(a => ({ ...a, easypaisa: e.target.value }))}
                placeholder="03001234567"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="acct-jazzcash" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                JazzCash
              </label>
              <input
                id="acct-jazzcash"
                inputMode="tel"
                maxLength={200}
                value={accounts.jazzcash}
                onChange={e => setAccounts(a => ({ ...a, jazzcash: e.target.value }))}
                placeholder="03001234567"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="acct-bank" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t('Bank account')}
              </label>
              <input
                id="acct-bank"
                maxLength={300}
                value={accounts.bank}
                onChange={e => setAccounts(a => ({ ...a, bank: e.target.value }))}
                placeholder="Meezan Bank — PK00MEZN0001234567890"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={savingSettings} className={primaryButton}>
          {savingSettings ? t('Saving…') : t('Save')}
        </button>
      </form>
    </Card>
  );
}
