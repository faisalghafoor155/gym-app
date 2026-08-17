import { Printer, X } from 'lucide-react';
import type { Payment } from '../types';
import { useAuth } from '../context/AuthContext';

interface ReceiptModalProps {
  payment: Payment;
  onClose: () => void;
}

export default function ReceiptModal({ payment, onClose }: ReceiptModalProps) {
  const { gym } = useAuth();

  const handlePrint = () => {
    window.print();
  };

  const paymentTypeLabel = {
    membership: 'Membership subscription renewal',
    supplement: 'Supplement purchase',
    other: 'Other services/products',
  }[payment.type] || 'Gym Payment';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/75 print:p-0 print:bg-transparent">
      {/* Modal Card container */}
      <div className="relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden print:border-0 print:shadow-none print:w-full print:max-w-none print:bg-white">
        
        {/* Header - Hidden in Print */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 print:hidden">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <Printer size={18} className="text-blue-600" />
            Receipt / Invoice
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Printable Area */}
        <div id="printable-receipt" className="p-6 font-sans text-gray-800 print:p-0 print:text-black">
          {/* Gym Details */}
          <div className="text-center pb-5 border-b border-dashed border-gray-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-black leading-tight">
              {gym?.name || 'GymPro'}
            </h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 print:text-gray-600 mt-1">
              Owner: {gym?.ownerName || 'Gym Management'}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 print:text-gray-600">
              Receipt ID: <span className="font-mono">{payment.id.split('-')[0]?.toUpperCase() || payment.id}</span>
            </p>
          </div>

          {/* Member Details */}
          <div className="my-5 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500 print:text-gray-600">Date:</span>
              <span className="font-medium">{new Date(payment.paymentDate).toLocaleDateString('en-PK', { dateStyle: 'medium' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500 print:text-gray-600">Member:</span>
              <span className="font-semibold text-gray-900 dark:text-white print:text-black">{payment.member.name}</span>
            </div>
            {payment.member.memberNo && (
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-slate-500 print:text-gray-600">Member No:</span>
                <span className="font-mono">{payment.member.memberNo}</span>
              </div>
            )}
            {payment.member.phone && (
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-slate-500 print:text-gray-600">Phone:</span>
                <span>{payment.member.phone}</span>
              </div>
            )}
          </div>

          {/* Payment Item details */}
          <div className="border-t border-b border-gray-100 dark:border-slate-800/80 py-4 my-4">
            <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-white print:text-black mb-2 pb-2 border-b border-gray-50 dark:border-slate-800/40">
              <span>Description</span>
              <span>Total</span>
            </div>
            <div className="flex justify-between text-sm">
              <div className="min-w-0 pr-4">
                <p className="font-medium text-gray-900 dark:text-slate-200 print:text-black truncate">
                  {paymentTypeLabel}
                </p>
                {payment.notes && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 print:text-gray-600 mt-0.5 break-all max-w-[250px]">
                    Note: {payment.notes}
                  </p>
                )}
              </div>
              <span className="font-mono font-semibold text-gray-900 dark:text-white print:text-black">
                Rs. {payment.amount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Grand Summary */}
          <div className="space-y-2 mt-4 text-sm">
            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white print:text-black border-b border-dashed border-gray-200 dark:border-slate-800 pb-2">
              <span>Paid Amount:</span>
              <span className="font-mono">Rs. {payment.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mt-2">
              <span className="text-gray-400 dark:text-slate-500 print:text-gray-600">Method:</span>
              <span className="font-semibold uppercase">{payment.method}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 dark:text-slate-500 print:text-gray-600">Status:</span>
              <span className={`font-semibold uppercase ${payment.status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                {payment.status}
              </span>
            </div>
            {payment.recordedBy && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 dark:text-slate-500 print:text-gray-600">Issued By:</span>
                <span>{payment.recordedBy.name}</span>
              </div>
            )}
          </div>

          {/* Thank you note */}
          <div className="text-center text-xs text-gray-400 dark:text-slate-500 print:text-gray-600 mt-8 border-t border-dashed border-gray-100 dark:border-slate-800 pt-4">
            <p className="font-medium">Thank you for training with us!</p>
            <p className="opacity-80 mt-0.5">Please keep this receipt for your records.</p>
          </div>
        </div>

        {/* Action Panel - Hidden in Print */}
        <div className="flex gap-3 p-4 bg-gray-50 dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-800 print:hidden">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl transition-colors"
          >
            Close
          </button>
          <button 
            type="button" 
            onClick={handlePrint}
            className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Printer size={15} />
            Print / Save
          </button>
        </div>

      </div>

      {/* Global CSS overrides for clean print preview */}
      <style>{`
        @media print {
          /* Hide everything in root except our modal */
          body > #root, 
          body > div:not(.fixed), 
          .print\\:hidden,
          header,
          aside,
          nav,
          button,
          .fixed > div:not(.relative) {
            display: none !important;
          }
          
          /* Position printable container at the top left */
          .fixed {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          .fixed > div {
            border: 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
