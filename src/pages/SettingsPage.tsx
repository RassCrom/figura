import { useEffect } from "react";
import { Link } from "react-router-dom";

import { TopNav } from "../components/TopNav";
import { en } from "../i18n/en";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { Basemap, Difficulty } from "../types/figure";

const difficulties: Difficulty[] = ["Explorer", "Scholar", "Conqueror"];
const basemaps: Basemap[] = ["Steppe", "OSM", "ESRI Topo", "ESRI Satellite", "CartoDB Dark"];

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
                  {item === "Explorer" ? "Popularity 90+" : item === "Scholar" ? "Popularity 85-89" : "Below 85"}
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
          <div className="chip-grid">
            {basemaps.map((item) => (
              <button
                key={item}
                type="button"
                className={basemap === item ? "chip selected" : "chip"}
                aria-pressed={basemap === item}
                onClick={() => setBasemap(item)}
              >
                {item}
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
