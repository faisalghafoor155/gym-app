import { useState } from 'react';
import { UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiError } from '../../api/client';
import {
  Card, FieldLabel, focusRing, inputClass, primaryButton, secondaryButton,
} from '../ui';
import type { MyProfile } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

/**
 * The contact details a member maintains themselves.
 *
 * Only what the server will take: `PUT /me` accepts phone, email, address,
 * emergency contact and date of birth, and nothing else on the record is a member's to
 * change. Name, photo and membership are the desk's, which is why they are
 * read on the Overview tab and not writable here.
 *
 * Email is shown but not editable, though the endpoint would accept it. It is
 * the address an invite and a password reset go to, so letting a member point
 * it somewhere else is letting them move their own login — a front-desk act
 * with a front-desk record of it, not a form field.
 */

/** The editable half of the record, kept as strings because that is what an
 *  input holds. Blank means "clear it", which the server stores as null. */
type Draft = {
  phone: string;
  address: string;
  emergencyContact: string;
  /** YYYY-MM-DD, as a date input holds it. */
  dateOfBirth: string;
};

const draftOf = (member: MyProfile['member']): Draft => ({
  phone: member.phone ?? '',
  address: member.address ?? '',
  emergencyContact: member.emergencyContact ?? '',
  dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0]! : '',
});

/** Blank is a real edit — it clears the field — so it is sent as null rather
 *  than omitted, which is how the server tells "clear this" from "leave it". */
const orNull = (value: string): string | null => value.trim() || null;

export default function MyProfileForm({
  member,
  onSaved,
}: {
  member: MyProfile['member'];
  /** The saved profile comes back off the PUT, so the page updates from the
   *  response rather than refetching what it was just handed. */
  onSaved: (profile: MyProfile) => void;
}) {
  const { t } = useLanguage();
  const saved = draftOf(member);
  const [draft, setDraft] = useState<Draft>(saved);
  const [saving, setSaving] = useState(false);

  const dirty = (Object.keys(saved) as (keyof Draft)[])
    .some(key => draft[key].trim() !== saved[key].trim());

  const set = (key: keyof Draft) => (value: string): void =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const submit = async (): Promise<void> => {
    // Guarded as well as disabled: Enter reaches the form even when the button
    // cannot be clicked, and an unchanged save is the one request the server
    // answers with a 400.
    if (!dirty || saving) return;

    setSaving(true);
    try {
      const { data } = await api.put<MyProfile>('/me', {
        phone: orNull(draft.phone),
        address: orNull(draft.address),
        emergencyContact: orNull(draft.emergencyContact),
        dateOfBirth: draft.dateOfBirth || null,
      });
      toast.success(t('Your details are saved'));
      onSaved(data);
    } catch (err) {
      // Left as typed. A rejected save is usually one field the server did not
      // like, and clearing the form would take the other three with it.
      toast.error(apiError(err, t('Could not save your details')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <UserCog size={16} className="text-blue-600" /> {t('Your details')}
      </h2>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
        {t('How the gym reaches you. Your name and membership are set at the front desk.')}
      </p>

      <form
        className="space-y-4"
        onSubmit={e => { e.preventDefault(); void submit(); }}
      >
        <div>
          <FieldLabel htmlFor="my-phone">{t('Phone')}</FieldLabel>
          <input
            id="my-phone"
            type="tel"
            value={draft.phone}
            onChange={e => set('phone')(e.target.value)}
            maxLength={30}
            placeholder="03xx xxxxxxx"
            className={inputClass}
          />
        </div>

        <div>
          <FieldLabel htmlFor="my-email">{t('Email')}</FieldLabel>
          {/* Read-only rather than absent: a member checking where their
              receipts go should be able to see it without asking. */}
          <input
            id="my-email"
            type="email"
            value={member.email ?? ''}
            readOnly
            disabled
            placeholder={t('Not set')}
            className={`${inputClass} cursor-not-allowed opacity-60`}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            {t('Your email is your sign-in. Ask the front desk to change it.')}
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="my-address">{t('Address')}</FieldLabel>
          <textarea
            id="my-address"
            value={draft.address}
            onChange={e => set('address')(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={t('House, street, area')}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <FieldLabel htmlFor="my-emergency">{t('Emergency contact')}</FieldLabel>
          <input
            id="my-emergency"
            type="text"
            value={draft.emergencyContact}
            onChange={e => set('emergencyContact')(e.target.value)}
            maxLength={100}
            placeholder={t('Name and number')}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            {t('Who the gym should call if something happens while you are training.')}
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="my-dob">{t('Date of birth')}</FieldLabel>
          <input
            id="my-dob"
            type="date"
            value={draft.dateOfBirth}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => set('dateOfBirth')(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            {t('So the gym can wish you on your birthday.')} 🎂
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button
            type="button"
            onClick={() => setDraft(saved)}
            disabled={!dirty || saving}
            className={`${secondaryButton} disabled:cursor-not-allowed`}
          >
            {t('Cancel')}
          </button>
          <button
            type="submit"
            disabled={!dirty || saving}
            className={`${primaryButton} ${focusRing}`}
          >
            {saving ? t('Saving…') : t('Save changes')}
          </button>
        </div>
      </form>
    </Card>
  );
}
