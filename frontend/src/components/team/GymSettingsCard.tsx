import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { Trash2, Upload, Building2 } from 'lucide-react';
import { Card, FieldLabel, inputClass, primaryButton } from '../ui';
import type { GymProfile, PaymentAccounts } from './types';

export default function GymSettingsCard({
  profile, setProfile, handleLogoChange, handleRemoveLogo,
  joiningFeeInput, setJoiningFeeInput, ptFeeInput, setPtFeeInput,
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
  accounts: PaymentAccounts;
  setAccounts: Dispatch<SetStateAction<PaymentAccounts>>;
  savingSettings: boolean;
  handleSettingsSave: (e: FormEvent) => void | Promise<void>;
}) {
  return (
    <Card className="p-5 mb-5">
      <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">Gym settings</h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        What members see on a receipt, pricing, and the accounts they send money to.
      </p>
      <form onSubmit={handleSettingsSave} className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            Gym details
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            Printed at the top of every receipt a member keeps.
          </p>
          <div className="mb-4 p-4 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/20 dark:ring-white/10 overflow-hidden">
              {profile.logo ? (
                <img src={profile.logo} alt="Gym Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="text-white/80" size={32} />
              )}
            </div>
            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <p className="text-xs font-bold text-gray-800 dark:text-slate-200">Gym Brand Logo</p>
                {profile.logo && (
                  <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Custom Logo Set</span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Appears in the desktop sidebar, mobile header, and receipts. PNG, JPG, or SVG up to 2MB.
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors">
                  <Upload size={13} />
                  <span>{profile.logo ? 'Change Logo' : 'Upload Logo'}</span>
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
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="gym-name">Gym name</FieldLabel>
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
              <FieldLabel htmlFor="gym-owner">Owner name</FieldLabel>
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
              <FieldLabel htmlFor="gym-phone">Phone</FieldLabel>
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
              <FieldLabel htmlFor="gym-address">Address</FieldLabel>
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
            Leave the phone or address blank and the receipt simply leaves that line out.
          </p>
        </div>

        <div className="max-w-xs border-t border-gray-100 dark:border-slate-800 pt-4">
          <label htmlFor="joining-fee" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            Fixed joining fee (Rs.)
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
            Filled in automatically on every new member, e.g. 3000. The desk can still
            change it for one member. Set it to 0 for no fixed fee.
          </p>
        </div>

        <div className="max-w-xs border-t border-gray-100 dark:border-slate-800 pt-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            Default trainer assignment fee (Rs.)
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
            Charged once when a member is put with a personal trainer. A trainer with their
            own fee set overrides this. Set it to 0 to charge nothing.
          </p>
        </div>

        <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            Payment accounts
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            Shown to the front desk when a member pays online, so they can say where to send
            it. Leave blank for any channel you do not use.
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
                Bank account
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
          {savingSettings ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Card>
  );
}
