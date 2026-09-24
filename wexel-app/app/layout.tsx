import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TabBar } from "@/components/TabBar";
import { Shell } from "@/components/Shell";

export const metadata = {
  title: "Wexel — automated stock rules for your wallet",
  description: "Buy real stocks with whatever's in your wallet, set a rule, and let it trade at 3am while you're snoring.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <WalletProviders>
            <Shell>{children}</Shell>
            <TabBar />
          </WalletProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
