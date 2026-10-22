import { useEffect, useState, type MouseEvent } from 'react';
import { CreditCard } from 'lucide-react';
import { primaryButton, secondaryButton } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { printIdCard } from '../../utils/idCard';
import { useDialog } from '../../hooks/useDialog';
import type { Member } from '../../types';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface Props {
  member: Member;
  onClose: () => void;
}

/**
 * The member's check-in code, big enough to scan off the screen.
 *
 * Generates the code itself rather than being handed one: the caller only
 * knows which member to show, and a page that generated it on click had to
 * carry the resulting data-url in its own state until the modal closed. Until
 * it renders, nothing is shown — a blank frame that then fills is worse than
 * the modal appearing complete.
 */
export default function MemberQrModal({ member, onClose }: Props) {
  const { gym } = useAuth();
  const [dataUrl, setDataUrl] = useState('');
  // Wired up only once there is something to render: until then this component
  // returns null, so there is no container for the trap to hold focus in.
  const dialogRef = useDialog(Boolean(dataUrl), onClose);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(member.id, {
      width: 280,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(url => { if (!cancelled) setDataUrl(url); })
      .catch(() => {
        if (cancelled) return;
        toast.error('Failed to generate QR code');
        // Nothing to show and no way to get it, so the modal closes rather
        // than sitting there empty.
        onClose();
      });
    return () => { cancelled = true; };
  }, [member.id, onClose]);

  if (!dataUrl) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
         onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
        className="w-full max-w-xs p-6 text-center bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 overflow-hidden">
          {member.photo
            ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
            : <span className="text-white text-lg font-bold">{getInitials(member.name)}</span>
          }
        </div>
        <h3 id="qr-modal-title" className="font-bold text-gray-900 dark:text-slate-100 text-lg">{member.name}</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">{member.memberNo} · {member.phone || 'No phone'}</p>
        <div className="bg-white p-3 rounded-xl inline-block shadow-sm border border-gray-100">
          <img src={dataUrl} alt={`QR Code for ${member.name}`} className="w-56 h-56" />
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">Scan this code at the front desk for instant check-in</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className={`flex-1 ${secondaryButton}`}>
            Close
          </button>
          <button
            onClick={() => {
              if (!printIdCard(member, dataUrl, { name: gym?.name ?? 'GymPro', logo: gym?.logo })) {
                toast.error('Allow pop-ups for this site to print the card');
              }
            }}
            className={`flex-1 ${primaryButton}`}
          >
            <CreditCard size={15} /> Print ID card
          </button>
        </div>
      </div>
    </div>
  );
}
