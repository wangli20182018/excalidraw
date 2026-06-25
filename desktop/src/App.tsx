import { useState } from "react";

import {
  CommandPalette,
  Excalidraw,
  MainMenu,
  defaultLang,
  languages,
} from "@excalidraw/excalidraw";

import type { Theme } from "@excalidraw/element/types";

type ThemeChoice = Theme | "system";

const resolveTheme = (choice: ThemeChoice): Theme =>
  choice === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : choice;

export default function App() {
  const [langCode, setLangCode] = useState(defaultLang.code);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("light");

  return (
    <div className="workspace-root">
      {/* P0: Excalidraw as pure spatial engine. Cards/overlay/runtime come in
          later phases and mount as a sibling layer above this container. */}
      <Excalidraw
        langCode={langCode}
        theme={resolveTheme(themeChoice)}
        onThemeChange={(t) => setThemeChoice(t)}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            toggleTheme: true,
          },
        }}
      >
        {/* Custom MainMenu — assembles the core DefaultItems that the bare
            default menu leaves out (Preferences, CommandPalette, …) plus a
            language picker (core ships no language UI, only `langCode`).
            Styling matches excalidraw-app: the <select> reuses the core
            `dropdown-select` classes, and ToggleTheme uses allowSystemTheme. */}
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.CommandPalette />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Socials />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Preferences />
          <MainMenu.DefaultItems.ToggleTheme
            allowSystemTheme
            theme={themeChoice}
          />
          <MainMenu.ItemCustom>
            <select
              className="dropdown-select dropdown-select__language"
              value={langCode}
              onChange={(e) => setLangCode(e.target.value)}
              style={{ width: "100%" }}
              aria-label="Language"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </MainMenu.ItemCustom>
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>

        {/* CommandPalette needs to be mounted for its menu item / Cmd+/ to
            work; it isn't rendered by the default shell. */}
        <CommandPalette />
      </Excalidraw>
    </div>
  );
}
