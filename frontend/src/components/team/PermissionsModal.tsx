import type { Dispatch, SetStateAction } from 'react';
import Modal from '../Modal';
import { primaryButton, secondaryButton } from '../ui';
import type { GymUser, StaffPermission } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import PermissionPicker from './PermissionPicker';

export default function PermissionsModal({
  editingPermissions, selectedPermission, setSelectedPermission, saving,
  handleUpdatePermissions, onClose,
}: {
  editingPermissions: GymUser;
  selectedPermission: StaffPermission;
  setSelectedPermission: Dispatch<SetStateAction<StaffPermission>>;
  saving: boolean;
  handleUpdatePermissions: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal title={t('Change Permissions for {name}', { name: editingPermissions.name })} onClose={() => onClose()}>
      <form onSubmit={e => {
        e.preventDefault();
        void handleUpdatePermissions();
      }} className="space-y-4">
        <PermissionPicker
          id="team-permission-level-2"
          value={selectedPermission}
          onChange={setSelectedPermission}
        />
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => onClose()}
            className={`flex-1 ${secondaryButton}`}>
            {t('Cancel')}
          </button>
          <button type="submit" disabled={saving}
            className={`flex-1 ${primaryButton}`}>
            {saving ? t('Saving...') : t('Save Permissions')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
