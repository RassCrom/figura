import { useEffect } from "react";
import { Link } from "react-router-dom";

import { TopNav } from "../components/TopNav";
import { en } from "../i18n/en";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { Basemap, Difficulty } from "../types/figure";

const difficulties: Difficulty[] = ["Explorer", "Scholar", "Conqueror"];
const basemaps: Array<{ name: Basemap; description: string }> = [
  { name: "Steppe", description: "Warm, label-free game style" },
  { name: "OSM", description: "Detailed streets and place labels" },
  { name: "ESRI Topo", description: "Terrain, borders, and elevation" },
  { name: "ESRI Satellite", description: "Real-world satellite imagery" },
  { name: "CartoDB Dark", description: "High-contrast dark city map" },
  { name: "Dark Night Blue", description: "Smooth midnight-blue terrain" },
  { name: "Historic", description: "Painterly watercolor atlas" },
  { name: "Custom Vector", description: "Cyber-styled borders and cities" },
];

export function SettingsPage({ categories }: { categories: string[] }) {
  const difficulty = useSettingsStore((state) => state.difficulty);
  const gameMode = useSettingsStore((state) => state.gameMode);
  const selectedCategories = useSettingsStore((state) => state.selectedCategories);
  const basemap = useSettingsStore((state) => state.basemap);
  const musicVol = useSettingsStore((state) => state.musicVol);
  const sfxVol = useSettingsStore((state) => state.sfxVol);
  const showSuggestions = useSettingsStore((state) => state.showSuggestions);
  const autoAdvanceReveal = useSettingsStore((state) => state.autoAdvanceReveal);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const mapTextures = useSettingsStore((state) => state.mapTextures);
  const setDifficulty = useSettingsStore((state) => state.setDifficulty);
  const setGameMode = useSettingsStore((state) => state.setGameMode);
  const setSelectedCategories = useSettingsStore((state) => state.setSelectedCategories);
  const toggleCategory = useSettingsStore((state) => state.toggleCategory);
  const setBasemap = useSettingsStore((state) => state.setBasemap);
  const setMusicVol = useSettingsStore((state) => state.setMusicVol);
  const setSfxVol = useSettingsStore((state) => state.setSfxVol);
  const setShowSuggestions = useSettingsStore((state) => state.setShowSuggestions);
  const setAutoAdvanceReveal = useSettingsStore((state) => state.setAutoAdvanceReveal);
  const setReducedMotion = useSettingsStore((state) => state.setReducedMotion);
  const setMapTextures = useSettingsStore((state) => state.setMapTextures);

  useEffect(() => {
    if (selectedCategories.length === 0) {
      setSelectedCategories(categories);
    }
  }, [categories, selectedCategories.length, setSelectedCategories]);

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel settings-panel" aria-labelledby="settings-title">
        <h1 id="settings-title">{en.settings}</h1>
        <fieldset>
          <legend>Game mode</legend>
          <div className="chip-grid">
            <button
              type="button"
              className={gameMode === "reverse" ? "chip selected" : "chip"}
              aria-pressed={gameMode === "reverse"}
              onClick={() => setGameMode("reverse")}
            >
              <span>Where?</span>
              <small>See the figure and click their birthplace.</small>
            </button>
            <button
              type="button"
              className={gameMode === "classic" ? "chip selected" : "chip"}
              aria-pressed={gameMode === "classic"}
              onClick={() => setGameMode("classic")}
            >
              <span>Who?</span>
              <small>Follow the journey and name the figure.</small>
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Difficulty</legend>
          <div className="chip-grid">
            {difficulties.map((item) => (
              <button
                key={item}
                type="button"
                className={difficulty === item ? "chip selected" : "chip"}
                aria-pressed={difficulty === item}
                onClick={() => setDifficulty(item)}
              >
                <span>{item}</span>
                <small>
                  {item === "Explorer"
                    ? "30s + 30s bank, 3 hints, full suggestions"
                    : item === "Scholar"
                      ? "24s + 15s bank, 2 hints, name-only suggestions"
                      : "18s, no bank, 1 hint, no suggestions or easy rounds"}
                </small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Categories</legend>
          <div className="chip-grid category-grid">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={selectedCategories.includes(category) ? "chip selected" : "chip"}
                aria-pressed={selectedCategories.includes(category)}
                onClick={() => toggleCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <p className="field-help">{en.categoriesRequired}</p>
        </fieldset>
        <fieldset>
          <legend>Basemap</legend>
          <div className="chip-grid basemap-grid">
            {basemaps.map((item) => (
              <button
                key={item.name}
                type="button"
                className={basemap === item.name ? "chip selected" : "chip"}
                aria-pressed={basemap === item.name}
                onClick={() => setBasemap(item.name)}
              >
                <span>{item.name}</span>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="slider-stack">
          <legend>Volume</legend>
          <label>
            <span>Music</span>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVol}
              onChange={(event) => setMusicVol(Number(event.target.value))}
            />
            <output>{musicVol}</output>
          </label>
          <label>
            <span>SFX</span>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVol}
              onChange={(event) => setSfxVol(Number(event.target.value))}
            />
            <output>{sfxVol}</output>
          </label>
        </fieldset>
        <fieldset>
          <legend>Gameplay & accessibility</legend>
          <div className="settings-toggle-list">
            <label className="settings-toggle">
              <span>
                <strong>Name suggestions</strong>
                <small>Show matching figures while typing.</small>
              </span>
              <input
                type="checkbox"
                checked={showSuggestions}
                onChange={(event) => setShowSuggestions(event.target.checked)}
              />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Auto-advance reveals</strong>
                <small>Move to the next round after the reveal timer.</small>
              </span>
              <input
                type="checkbox"
                checked={autoAdvanceReveal}
                onChange={(event) => setAutoAdvanceReveal(event.target.checked)}
              />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Reduce motion</strong>
                <small>Disable cinematic map and level-up motion.</small>
              </span>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Map textures</strong>
                <small>Show grain, paper fibers, and scanline overlays.</small>
              </span>
              <input
                type="checkbox"
                checked={mapTextures}
                onChange={(event) => setMapTextures(event.target.checked)}
              />
            </label>
          </div>
        </fieldset>
        <Link className="primary-button" to="/">
          Done
        </Link>
      </section>
    </main>
  );
}
