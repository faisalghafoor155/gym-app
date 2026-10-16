import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const FONT = fontFamily;
export const FPS = 30;

/** The app's own palette (Tailwind values used across the frontend). */
export const C = {
  blue: '#2563eb',
  blueDark: '#1d4ed8',
  blueSoft: '#dbeafe',
  ink: '#0f172a',
  text: '#334155',
  muted: '#64748b',
  line: '#e2e8f0',
  bg: '#f1f5f9',
  white: '#ffffff',
  emerald: '#059669',
  emeraldSoft: '#ecfdf5',
  rose: '#e11d48',
  roseSoft: '#fff1f2',
  amber: '#d97706',
  amberSoft: '#fffbeb',
  slateSoft: '#f1f5f9',
  whatsapp: '#25d366',
  whatsappDark: '#075e54',
};

export const money = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;
