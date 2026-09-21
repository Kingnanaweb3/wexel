"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark", toggle: () => {},
});

export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // On first load, follow the saved choice, else the OS preference.
  useEffect(() => {
    const saved = localStorage.getItem("wexel-theme") as Theme | null;
    setTheme(saved ?? "dark");
  }, []);

  // Drive the CSS variables off a data attribute on <html>.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("wexel-theme", theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme(t => t === "dark" ? "light" : "dark") }}>
      {children}
    </Ctx.Provider>
  );
}
