import { useEffect, useState } from "react";

function isDarkColor(color: string): boolean {
  const hex = color.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hex) {
    const [, r, g, b] = hex;
    const luminance =
      (0.2126 * Number.parseInt(r, 16) +
        0.7152 * Number.parseInt(g, 16) +
        0.0722 * Number.parseInt(b, 16)) /
      255;
    return luminance < 0.5;
  }

  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    const [, r, g, b] = rgb;
    const luminance =
      (0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b)) / 255;
    return luminance < 0.5;
  }

  return false;
}

function getAppEditorTheme(): "vs" | "vs-dark" {
  const styles = getComputedStyle(document.body);
  const appBackground =
    styles.getPropertyValue("--color-bg-primary") || styles.backgroundColor;
  return isDarkColor(appBackground) ? "vs-dark" : "vs";
}

export function useAppEditorTheme(): "vs" | "vs-dark" {
  const [theme, setTheme] = useState<"vs" | "vs-dark">(getAppEditorTheme);

  useEffect(() => {
    const updateTheme = () => setTheme(getAppEditorTheme());
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
