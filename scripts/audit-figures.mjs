import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourcePath = path.join(process.cwd(), "src", "data", "figures.json");
const fix = process.argv.includes("--fix");
const candidateFileNames = ["sportspeople.json", "explorers.json"];
const categoryAliases = new Map([["Sportsman", "Sportsperson"]]);
const categoryEvidence = new Map([
  [
    "Sportsperson",
    /\b(athlete|boxer|footballer|runner|swimmer|martial artist|racing driver|racecar driver|sportsperson|sportsman|sportswoman|cyclist|tennis player|basketball player|baseball player|cricketer|wrestler|skier|gymnast)\b/i,
  ],
  ["Explorer", /\b(explorer|navigator|expedition|voyage|cosmonaut|astronaut)\b/i],
]);

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_\W]+/g, " ")
    .trim()
    .toLowerCase();
}

function fullName(figure) {
  return `${figure.first_name ?? ""} ${figure.last_name ?? ""}`.trim();
}

function figureId(figure) {
  return normalizeName(fullName(figure)).replace(/\s+/g, "-");
}

function historicalYear(value) {
  const match = String(value ?? "").match(/\d{1,4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return /\bBC\b/i.test(value) ? -year : year;
}

function gameReadinessIssues(figure) {
  const issues = [];
  for (const field of [
    "first_name",
    "nationality",
    "country_of_origin",
    "place_of_birth",
    "place_of_death",
    "category",
    "description",
    "birth_date",
    "death_date",
    "photo",
  ]) {
    if (typeof figure[field] !== "string" || !figure[field].trim()) issues.push(field);
  }
  for (const field of [
    "coordinates_of_the_place_of_birth",
    "coordinates_of_the_place_of_death",
  ]) {
    const coordinate = figure[field];
    if (
      !Array.isArray(coordinate) ||
      coordinate.length !== 2 ||
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1])
    ) {
      issues.push(field);
    }
  }
  return issues;
}

function likelySamePerson(left, right) {
  const leftTokens = new Set(normalizeName(fullName(left)).split(" "));
  const sharedDistinctiveName = normalizeName(fullName(right))
    .split(" ")
    .some((token) => token.length > 3 && leftTokens.has(token));
  const nearby = (leftCoordinates, rightCoordinates) =>
    Array.isArray(leftCoordinates) &&
    Array.isArray(rightCoordinates) &&
    Math.abs(leftCoordinates[0] - rightCoordinates[0]) < 0.1 &&
    Math.abs(leftCoordinates[1] - rightCoordinates[1]) < 0.1;
  return (
    sharedDistinctiveName &&
    left.birth_date === right.birth_date &&
    left.death_date === right.death_date &&
    nearby(left.coordinates_of_the_place_of_birth, right.coordinates_of_the_place_of_birth) &&
    nearby(left.coordinates_of_the_place_of_death, right.coordinates_of_the_place_of_death)
  );
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const candidateCatalogs = await Promise.all(
  candidateFileNames.map((fileName) =>
    readFile(path.join(process.cwd(), "data", fileName), "utf8")
      .then((contents) => JSON.parse(contents))
      .catch(() => []),
  ),
);
let candidateDuplicates = 0;
const deduplicatedCandidateCatalogs = candidateCatalogs.map((catalog) => {
  const unique = new Map();
  for (const candidate of catalog) {
    if (unique.has(candidate.id)) candidateDuplicates += 1;
    else unique.set(candidate.id, candidate);
  }
  return [...unique.values()];
});
const candidatesByName = new Map();
for (const candidate of deduplicatedCandidateCatalogs.flat()) {
  const name = normalizeName(candidate.name);
  if (!candidatesByName.has(name)) candidatesByName.set(name, candidate);
}
const cleaned = [];
const ids = new Map();
const removed = [];
const warnings = [];
let standardizedCategories = 0;
let addedProvenance = 0;

for (const original of source) {
  const figure = { ...original };
  const canonicalCategory = categoryAliases.get(figure.category);
  if (canonicalCategory) {
    figure.category = canonicalCategory;
    standardizedCategories += 1;
  }

  const name = fullName(figure);
  const candidate = candidatesByName.get(normalizeName(name));
  if (!figure.source_url && !figure._slug && !figure.wikidata_id && candidate?.id) {
    figure.wikidata_id = candidate.id;
    figure.source_url = `https://www.wikidata.org/wiki/${candidate.id}`;
    addedProvenance += 1;
  }
  const id = figureId(figure);
  if (!id || /^q\d+$/i.test(name)) {
    removed.push(`${name || "(blank name)"}: placeholder identity`);
    continue;
  }

  const existing = ids.get(id);
  if (existing) {
    removed.push(`${name}: duplicate generated id "${id}"`);
    continue;
  }

  const evidencePattern = categoryEvidence.get(figure.category);
  if (!figure._slug && !figure.source_url && evidencePattern && !evidencePattern.test(figure.description)) {
    removed.push(`${name}: no ${figure.category} evidence in description`);
    continue;
  }

  const birthYear = historicalYear(figure.birth_date);
  const deathYear = historicalYear(figure.death_date);
  if (birthYear !== null && deathYear !== null && deathYear < birthYear) {
    removed.push(`${name}: death year ${deathYear} precedes birth year ${birthYear}`);
    continue;
  }

  const samePerson = cleaned.find((candidate) => likelySamePerson(candidate, figure));
  if (samePerson) {
    removed.push(`${name}: likely duplicate of ${fullName(samePerson)}`);
    continue;
  }

  ids.set(id, figure);
  cleaned.push(figure);
}

if (fix) {
  await Promise.all([
    writeFile(sourcePath, `${JSON.stringify(cleaned, null, 2)}\n`),
    ...deduplicatedCandidateCatalogs.map((catalog, index) =>
      writeFile(
        path.join(process.cwd(), "data", candidateFileNames[index]),
        `${JSON.stringify(catalog, null, 2)}\n`,
      ),
    ),
  ]);
}

const readinessFailures = new Map();
const gameReady = cleaned.filter((figure) => {
  const issues = gameReadinessIssues(figure);
  for (const issue of issues) {
    readinessFailures.set(issue, (readinessFailures.get(issue) ?? 0) + 1);
  }
  return issues.length === 0;
});
const provenanceCount = cleaned.filter(
  (figure) => figure.source_url || figure._slug || figure.wikidata_id,
).length;
const gameReadyCategories = new Map();
for (const figure of gameReady) {
  gameReadyCategories.set(figure.category, (gameReadyCategories.get(figure.category) ?? 0) + 1);
}

console.log(`Figures assessed: ${source.length}.`);
console.log(`Clean figures: ${cleaned.length}.`);
console.log(`Game-ready figures: ${gameReady.length}.`);
console.log(
  `Game-ready categories: ${[...gameReadyCategories.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([category, count]) => `${category}=${count}`)
    .join(", ")}.`,
);
console.log(`Figures with explicit provenance: ${provenanceCount}.`);
console.log(
  `Incomplete source rows: ${cleaned.length - gameReady.length}${
    readinessFailures.size
      ? ` (${[...readinessFailures.entries()]
          .sort((left, right) => right[1] - left[1])
          .map(([field, count]) => `${field}=${count}`)
          .join(", ")})`
      : ""
  }.`,
);
console.log(`Removed reliability failures: ${removed.length}.`);
console.log(`Standardized categories: ${standardizedCategories}.`);
console.log(`Added provenance references: ${addedProvenance}.`);
console.log(`Duplicate candidate rows: ${candidateDuplicates}.`);
console.log(`Review warnings: ${warnings.length}.`);
for (const issue of removed) console.log(`ERROR: ${issue}`);
for (const warning of warnings) console.log(`WARN: ${warning}`);

if (
  !fix &&
  (removed.length > 0 ||
    standardizedCategories > 0 ||
    addedProvenance > 0 ||
    candidateDuplicates > 0 ||
    warnings.length > 0)
) {
  process.exitCode = 1;
}
