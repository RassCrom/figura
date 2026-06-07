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
  const selectedCategories = useSettingsStore((state) => state.selectedCategories);
  const basemap = useSettingsStore((state) => state.basemap);
  const musicVol = useSettingsStore((state) => state.musicVol);
  const sfxVol = useSettingsStore((state) => state.sfxVol);
  const setDifficulty = useSettingsStore((state) => state.setDifficulty);
  const setSelectedCategories = useSettingsStore((state) => state.setSelectedCategories);
  const toggleCategory = useSettingsStore((state) => state.toggleCategory);
  const setBasemap = useSettingsStore((state) => state.setBasemap);
  const setMusicVol = useSettingsStore((state) => state.setMusicVol);
  const setSfxVol = useSettingsStore((state) => state.setSfxVol);

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
                    ? "Famous faces — great for beginners"
                    : item === "Scholar"
                      ? "Lesser-known but significant figures"
                      : "The deepest cut — for true historians"}
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
        <Link className="primary-button" to="/">
          Done
        </Link>
      </section>
    </main>
  );
}
