import type { Dispatch, FormEvent, SetStateAction } from 'react';
import Modal from '../Modal';
import { FieldLabel, inputClass, primaryButton, secondaryButton } from '../ui';
import type { Member } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import PasswordMethod from './PasswordMethod';
import type { AccountMethod, LoginForm } from './types';

export default function MemberLoginModal({
  membersWithoutLogin, loginForm, setLoginForm, loginMethod, setLoginMethod,
  saving, handleAddMemberLogin, onClose,
}: {
  membersWithoutLogin: Member[];
  loginForm: LoginForm;
  setLoginForm: Dispatch<SetStateAction<LoginForm>>;
  loginMethod: AccountMethod;
  setLoginMethod: (m: AccountMethod) => void;
  saving: boolean;
  handleAddMemberLogin: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal title={t('Give a Member Login Access')} onClose={() => onClose()}>
      <form onSubmit={e => void handleAddMemberLogin(e)} className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('The member will be able to see only their own plan, attendance and dues.')}
        </p>
        {membersWithoutLogin.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">
            {t('Every member already has a login.')}
          </p>
        ) : (
          <>
            <div>
              <FieldLabel htmlFor="team-member" required>{t('Member')}</FieldLabel>
              <select id="team-member" required value={loginForm.memberId}
                onChange={e => setLoginForm(f => ({ ...f, memberId: e.target.value }))}
                className={inputClass}>
                <option value="">{t('Select member...')}</option>
                {membersWithoutLogin.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="team-email-2" required>{t('Email')}</FieldLabel>
              <input id="team-email-2" type="email" required value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                placeholder="member@example.com"
                className={inputClass} />
            </div>
            <PasswordMethod
              method={loginMethod}
              onMethod={setLoginMethod}
              password={loginForm.password}
              onPassword={p => setLoginForm(f => ({ ...f, password: p }))}
            />
          </>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => onClose()}
            className={`flex-1 ${secondaryButton}`}>
            {t('Cancel')}
          </button>
          <button type="submit" disabled={saving || membersWithoutLogin.length === 0}
            className={`flex-1 ${primaryButton}`}>
            {saving ? t('Creating...') : t('Create Login')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
