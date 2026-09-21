import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TabBar } from "@/components/TabBar";

export const metadata = {
  title: "Wexel",
  description: "Buy tokenized stocks with any token. Set rules. Walk away.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <WalletProviders>
            <div style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 100 }}>
              {children}
            </div>
            <TabBar />
          </WalletProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
