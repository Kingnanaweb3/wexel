"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Zap, User } from "lucide-react";

const TABS = [
  { href: "/markets", label: "Markets", Icon: Home },
  { href: "/portfolio", label: "Wallet", Icon: Wallet },
  { href: "/rules", label: "Rules", Icon: Zap },
  { href: "/profile", label: "Profile", Icon: User },
];

export function TabBar() {
  const path = usePathname();
  if (path === "/" || path.startsWith("/stock")) return null;

  return (
    <nav className="tabbar">
      {TABS.map(({ href, label, Icon }) => {
        const on = path.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? "on" : ""}>
            <Icon size={18} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
