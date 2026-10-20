"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("emc-theme", theme);
  window.dispatchEvent(new Event("emc-theme-change"));
};

const subscribe = (notify: () => void) => {
  window.addEventListener("emc-theme-change", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("emc-theme-change", notify);
    window.removeEventListener("storage", notify);
  };
};

const getTheme = (): Theme => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerTheme = (): Theme => "light";

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  const chooseTheme = (nextTheme: Theme) => {
    applyTheme(nextTheme);
  };

  return (
    <div className="theme-toggle" role="group" aria-label="Velg fargetema">
      <button
        type="button"
        className={theme === "light" ? "is-active" : ""}
        aria-pressed={theme === "light"}
        onClick={() => chooseTheme("light")}
      >
        <Sun size={14} aria-hidden="true" />
        <span>Dag</span>
      </button>
      <button
        type="button"
        className={theme === "dark" ? "is-active" : ""}
        aria-pressed={theme === "dark"}
        onClick={() => chooseTheme("dark")}
      >
        <Moon size={14} aria-hidden="true" />
        <span>Natt</span>
      </button>
    </div>
  );
}
