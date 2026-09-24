"use client";

import { usePathname } from "next/navigation";

// The app is a phone-width column. The landing page is not.
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/") return <>{children}</>;
  return <div style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 100 }}>{children}</div>;
}
