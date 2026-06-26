import { useCallback, useRef, useState } from "react";

import {
  CommandPalette,
  Excalidraw,
  ExcalidrawAPIProvider,
  MainMenu,
  defaultLang,
  languages,
  useExcalidrawAPI,
  useHandleLibrary,
} from "@excalidraw/excalidraw";
import type { LibraryPersistenceAdapter } from "@excalidraw/excalidraw/data/library";

import type { Theme } from "@excalidraw/element/types";

import { Minimap } from "./Minimap";
import type { MinimapScene } from "./Minimap";

// --- Library persistence (localStorage adapter) -----------------------------
// The core ships no default storage; without an adapter the library is
// in-memory only (empty every reload, nothing saved). Mirror what
// excalidraw-app does with IndexedDB, but via localStorage for simplicity.
const LIB_KEY = "excalidraw-desktop-library";

const libraryAdapter: LibraryPersistenceAdapter = {
  load: () => {
    try {
      const raw = localStorage.getItem(LIB_KEY);
      return raw ? { libraryItems: JSON.parse(raw) } : null;
    } catch {
      return null;
    }
  },
  save: (data) => {
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(data.libraryItems));
    } catch {
      // ignore quota / serialization errors
    }
  },
};

// --- Theme ------------------------------------------------------------------
type ThemeChoice = Theme | "system";

const resolveTheme = (choice: ThemeChoice): Theme =>
  choice === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : choice;

function Editor() {
  const [langCode, setLangCode] = useState(defaultLang.code);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("light");

  const excalidrawAPI = useExcalidrawAPI();
  useHandleLibrary({ excalidrawAPI, adapter: libraryAdapter });

  // forward scene changes to the minimap without causing editor re-renders
  const sceneSub = useRef<(d: MinimapScene) => void>(() => {});
  const subscribe = useCallback(
    (fn: (d: MinimapScene) => void) => {
      sceneSub.current = fn;
    },
    [],
  );
  const handleChange = (
    elements: readonly MinimapScene["elements"][number][],
    appState: MinimapScene["appState"],
    files: MinimapScene["files"],
  ) => {
    sceneSub.current({ elements, appState, files });
  };

  return (
    <>
      <Excalidraw
        langCode={langCode}
        theme={resolveTheme(themeChoice)}
        onThemeChange={(t) => setThemeChoice(t)}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            toggleTheme: true,
          },
        }}
      >
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

        <CommandPalette />
      </Excalidraw>

      <Minimap excalidrawAPI={excalidrawAPI} subscribe={subscribe} />
    </>
  );
}

export default function App() {
  return (
    <div className="workspace-root">
      <ExcalidrawAPIProvider>
        <Editor />
      </ExcalidrawAPIProvider>
    </div>
  );
}
