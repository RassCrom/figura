import type { Continent, Difficulty, Figure } from "../types/figure";

let loadedFigures: Figure[] | null = null;
let loadPromise: Promise<Figure[]> | null = null;

export function loadFigures(): Promise<Figure[]> {
  if (loadedFigures) {
    return Promise.resolve(loadedFigures);
  }
  loadPromise ??= fetch(`${import.meta.env.BASE_URL}data/figures.json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load figures: ${response.status}`);
      }
      return response.json() as Promise<Figure[]>;
    })
    .then((figures) => {
      loadedFigures = figures;
      return figures;
    });
  return loadPromise;
}

export function getValidatedFigures(): Figure[] {
  return loadedFigures ?? [];
}

export function getCategories(figures: Figure[] = loadedFigures ?? []): string[] {
  return [...new Set(figures.map((figure) => figure.category))].sort((a, b) => a.localeCompare(b));
}

export function getFullName(figure: Figure): string {
  return `${figure.first_name} ${figure.last_name}`.trim();
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_\W]+/g, " ")
    .trim()
    .toLowerCase();
}

export function figureMatchesDifficulty(figure: Figure, difficulty: Difficulty): boolean {
  if (difficulty === "Explorer") {
    return figure.popularity_rating >= 90;
  }

  if (difficulty === "Scholar") {
    return figure.popularity_rating >= 85 && figure.popularity_rating <= 89;
  }

  return figure.popularity_rating < 85;
}

export function getDifficultyPool(
  figures: Figure[],
  difficulty: Difficulty,
  selectedCategories: string[],
): Figure[] {
  return figures.filter(
    (figure) =>
      figureMatchesDifficulty(figure, difficulty) && selectedCategories.includes(figure.category),
  );
}

export function getRelaxedPool(figures: Figure[], selectedCategories: string[]): Figure[] {
  const categoryPool = figures.filter((figure) => selectedCategories.includes(figure.category));
  return categoryPool.length >= 5 ? categoryPool : figures;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

export function getWikipediaUrl(figure: Figure): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(getFullName(figure).replace(/\s+/g, "_"))}`;
}

export function extractYearRange(description: string): string {
  const years = description.match(/\b(?:1[0-9]{3}|20[0-2][0-9]|[5-9][0-9]{2})\b/g);
  if (!years || years.length < 2) {
    return "Dates unavailable";
  }

  return `${years[0]} - ${years[1]}`;
}

export function extractLifeYears(description: string): {
  birthYear: string | null;
  deathYear: string | null;
} {
  const years = description.match(/\b(?:1[0-9]{3}|20[0-2][0-9]|[5-9][0-9]{2})\b/g);
  return {
    birthYear: years?.[0] ?? null,
    deathYear: years?.[1] ?? null,
  };
}

export function getLifeDateRange(
  figure: Pick<Figure, "birth_date" | "death_date" | "description">,
): string {
  if (figure.birth_date && figure.death_date) {
    return `${figure.birth_date} - ${figure.death_date}`;
  }

  return extractYearRange(figure.description);
}

export function getLifeDateHints(
  figure: Pick<Figure, "birth_date" | "death_date" | "description">,
): { birthDate: string | null; deathDate: string | null } {
  if (figure.birth_date || figure.death_date) {
    return {
      birthDate: figure.birth_date || null,
      deathDate: figure.death_date || null,
    };
  }

  const years = extractLifeYears(figure.description);
  return {
    birthDate: years.birthYear,
    deathDate: years.deathYear,
  };
}

export function distanceKm(from: [number, number], to: [number, number]): number {
  const [lat1, lng1] = from.map((value) => (value * Math.PI) / 180);
  const [lat2, lng2] = to.map((value) => (value * Math.PI) / 180);
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function inferContinent([lat, lng]: [number, number]): Continent {
  // Oceania: Australia + Pacific islands
  if (lat <= -8 && lng >= 110 && lng <= 180) {
    return "Oceania";
  }

  // Americas
  if (lng >= -170 && lng <= -30) {
    return lat >= 12 ? "North America" : "South America";
  }

  // Europe: rough northern landmass
  if (lat >= 35 && lng >= -25 && lng <= 45) {
    return "Europe";
  }

  // Africa: extend east to include the Horn of Africa and Red Sea coast
  if (lat >= -35 && lat <= 38 && lng >= -20 && lng <= 55) {
    return "Africa";
  }

  // Asia: covers the rest (Middle East, Central Asia, South/East/Southeast Asia,
  // Siberia). Intentionally broad — checked last so Europe and Africa take priority.
  if (lat >= -10 && lat <= 80 && lng >= 25 && lng <= 180) {
    return "Asia";
  }

  return "Unknown";
}
