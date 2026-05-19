import './globals.css';

export const metadata = {
  title: 'Receipt to Sheet',
  description: 'Upload a receipt photo, it logs to your Google Sheet.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
