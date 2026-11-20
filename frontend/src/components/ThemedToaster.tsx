import { Toaster } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { SuccessCheck } from './ui';

/**
 * The toasts render into a portal outside the styled tree, so they take their
 * colours from props rather than from a `dark:` class. Split into its own
 * component because it has to sit inside the provider to read the theme.
 */
export default function ThemedToaster() {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: dark ? '#1e293b' : '#ffffff',
          color: dark ? '#e2e8f0' : '#1e293b',
          border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
        },
        // Every saved payment, member and check-in that reports through a
        // toast gets the same drawn tick as the check-in panel.
        success: {
          icon: <SuccessCheck size={20} className={dark ? 'text-green-400' : 'text-green-600'} />,
        },
      }}
    />
  );
}
