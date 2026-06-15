import type { Continent, Difficulty, FeaturedFigure, Figure, FigureIndex } from "../types/figure";

let loadedIndex: FigureIndex[] | null = null;
let indexPromise: Promise<FigureIndex[]> | null = null;
const recordCache = new Map<string, Figure>();
let featuredPromise: Promise<FeaturedFigure[]> | null = null;
const searchIndexCache = new WeakMap<FigureIndex[], FigureSearchEntry[]>();
const TRUSTED_REFERENCE_HOSTS = new Set(["en.wikipedia.org", "www.wikidata.org"]);

type FigureSearchEntry = {
  figure: FigureIndex;
  names: string[];
  lastName: string;
  fuzzyNames: string[];
};

function getFigureSearchIndex(figures: FigureIndex[]): FigureSearchEntry[] {
  const cached = searchIndexCache.get(figures);
  if (cached) {
    return cached;
  }

  const index = figures.map((figure) => {
    const names = [...new Set([getFullName(figure), ...figure.aliases].map(normalizeName))];
    const lastName = normalizeName(figure.last_name);
    return {
      figure,
      names,
      lastName,
      fuzzyNames: [...new Set([...names, lastName].filter(Boolean))],
    };
  });
  searchIndexCache.set(figures, index);
  return index;
}

export function loadFigureIndex(): Promise<FigureIndex[]> {
  if (loadedIndex) {
    return Promise.resolve(loadedIndex);
  }
  indexPromise ??= fetch(`${import.meta.env.BASE_URL}data/figure-index.json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load figures: ${response.status}`);
      }
      return response.json() as Promise<FigureIndex[]>;
    })
    .then((figures) => {
      loadedIndex = figures;
      return figures;
    });
  return indexPromise;
}

export async function loadFigureRecord(id: string): Promise<Figure> {
  const cached = recordCache.get(id);
  if (cached) return cached;
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/figures/${encodeURIComponent(id)}.json`,
  );
  if (!response.ok) throw new Error(`Unable to load figure ${id}: ${response.status}`);
  const figure = (await response.json()) as Figure;
  recordCache.set(id, figure);
  return figure;
}

export function loadFigureRecords(figures: FigureIndex[]): Promise<Figure[]> {
  return Promise.all(figures.map((figure) => loadFigureRecord(figure.id)));
}

export function loadFeaturedFigures(): Promise<FeaturedFigure[]> {
  featuredPromise ??= fetch(`${import.meta.env.BASE_URL}data/featured-figures.json`).then(
    (response) => {
      if (!response.ok) throw new Error(`Unable to load featured figures: ${response.status}`);
      return response.json() as Promise<FeaturedFigure[]>;
    },
  );
  return featuredPromise;
}

export function getValidatedFigureIndex(): FigureIndex[] {
  return loadedIndex ?? [];
}

export function getCategories(figures: FigureIndex[] = loadedIndex ?? []): string[] {
  return [...new Set(figures.map((figure) => figure.category))].sort((a, b) => a.localeCompare(b));
}

export function getFullName(figure: Pick<Figure, "first_name" | "last_name">): string {
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

export function parseHistoricalYear(value: string): number | null {
  const century = value.match(/\b(\d+)(?:st|nd|rd|th)\s+century\s+BC\b/i);
  if (century) {
    return -(Number(century[1]) - 1) * 100 - 1;
  }

  const year = value.match(/\b\d{1,4}\b/);
  if (!year) {
    return null;
  }
  const numericYear = Number(year[0]);
  return /\bBC\b/i.test(value) ? -numericYear : numericYear;
}

export function figureMatchesDifficulty(figure: FigureIndex, difficulty: Difficulty): boolean {
  if (difficulty === "Explorer") {
    return figure.popularity_rating >= 90;
  }

  if (difficulty === "Scholar") {
    return figure.popularity_rating >= 85 && figure.popularity_rating <= 89;
  }

  return figure.popularity_rating < 85;
}

export function getDifficultyPool(
  figures: FigureIndex[],
  difficulty: Difficulty,
  selectedCategories: string[],
): FigureIndex[] {
  return figures.filter(
    (figure) =>
      figureMatchesDifficulty(figure, difficulty) && selectedCategories.includes(figure.category),
  );
}

export function getRelaxedPool(
  figures: FigureIndex[],
  selectedCategories: string[],
): FigureIndex[] {
  return figures.filter((figure) => selectedCategories.includes(figure.category));
}

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function typoTolerance(value: string): number {
  return value.length >= 10 ? 2 : value.length >= 5 ? 1 : 0;
}

export function resolveFigureGuess(guess: string, figures: FigureIndex[]): FigureIndex | null {
  const query = normalizeName(guess);
  if (!query) return null;

  const searchIndex = getFigureSearchIndex(figures);
  const exact = searchIndex.filter((entry) => entry.names.includes(query));
  if (exact.length === 1) return exact[0].figure;

  const lastName = searchIndex.filter((entry) => entry.lastName && entry.lastName === query);
  if (lastName.length === 1) return lastName[0].figure;

  const fuzzy = searchIndex.filter((entry) =>
    entry.fuzzyNames.some((name) => levenshteinDistance(query, name) <= typoTolerance(name)),
  );
  return fuzzy.length === 1 ? fuzzy[0].figure : null;
}

export function searchFigureSuggestions(
  query: string,
  figures: FigureIndex[],
  limit: number,
): FigureIndex[] {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  const matches: FigureIndex[] = [];
  for (const entry of getFigureSearchIndex(figures)) {
    if (entry.names.some((name) => name.includes(normalizedQuery))) {
      matches.push(entry.figure);
      if (matches.length >= limit) {
        break;
      }
    }
  }
  return matches;
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
  const trustedSource = getTrustedReferenceUrl(figure.source_url);
  if (trustedSource) {
    return trustedSource;
  }
  // Search instead of a direct /wiki/ link: an exact title match redirects
  // straight to the article, while names that need disambiguation (or differ
  // from "First Last") land on search results instead of a 404.
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(getFullName(figure))}`;
}

export function getTrustedReferenceUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TRUSTED_REFERENCE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
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

  // Maghreb coast (Algiers, Tunis, Annaba) sits above 35°N and would
  // otherwise fall into the Europe box. Checked first; the longitude range
  // starts at -2 so southern Spain (Malaga, Cadiz) stays in Europe.
  if (lat >= 35 && lat <= 37.5 && lng >= -2 && lng <= 12) {
    return "Africa";
  }

  // Europe: rough northern landmass
  if (lat >= 35 && lng >= -25 && lng <= 45) {
    return "Europe";
  }

  // Africa. North of ~12°N the eastern edge stops at the Suez/Sinai line so
  // the Levant and Arabian Peninsula (Jerusalem, Mecca, Riyadh) fall through
  // to Asia; south of it the box extends to 55°E for the Horn of Africa.
  if (lat >= 12 && lat <= 38 && lng >= -20 && lng <= 34) {
    return "Africa";
  }
  if (lat >= -35 && lat < 12 && lng >= -20 && lng <= 55) {
    return "Africa";
  }

  // Asia: covers the rest (Middle East, Central Asia, South/East/Southeast Asia,
  // Siberia). Intentionally broad — checked last so Europe and Africa take priority.
  if (lat >= -10 && lat <= 80 && lng >= 25 && lng <= 180) {
    return "Asia";
  }

  return "Unknown";
}
