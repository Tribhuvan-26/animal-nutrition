import './globals.css';
import SplashIntro from '@/app/components/SplashIntro';

export const metadata = {
  title: 'Rudra — Sales Ledger to Sheet',
  description: 'Upload a receipt photo, it logs to your Google Sheet.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SplashIntro />
        {children}
      </body>
    </html>
  );
}
