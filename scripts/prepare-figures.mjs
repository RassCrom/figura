import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "src", "data", "figures.json");
const dataDirectory = path.join(root, "public", "data");
const legacyOutputPath = path.join(dataDirectory, "figures.json");
const indexPath = path.join(dataDirectory, "figure-index.json");
const featuredPath = path.join(dataDirectory, "featured-figures.json");
const recordsDirectory = path.join(dataDirectory, "figures");
const checkOnly = process.argv.includes("--check");

async function writeIfChanged(filePath, output) {
  const current = await readFile(filePath, "utf8").catch(() => "");
  if (current !== output) {
    await writeFile(filePath, output);
    return true;
  }
  return false;
}

async function removeGeneratedFile(filePath) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rm(filePath, { force: true });
      return true;
    } catch (error) {
      if (!["EBUSY", "EPERM"].includes(error.code) || attempt === 3) {
        console.warn(`Unable to remove stale generated file: ${filePath} (${error.code})`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }
  return false;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isCoordinate(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] >= -90 &&
    value[0] <= 90 &&
    value[1] >= -180 &&
    value[1] <= 180
  );
}

function isUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function historicalYear(value) {
  const match = String(value ?? "").match(/\d{1,4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return /\bBC\b/i.test(value) ? -year : year;
}

function validateFigure(figure) {
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
  ]) {
    if (!isNonEmptyString(figure[field])) issues.push(field);
  }
  if (typeof figure.last_name !== "string") issues.push("last_name");
  if (typeof figure.flag !== "string") issues.push("flag");
  if (!isCoordinate(figure.coordinates_of_the_place_of_birth)) {
    issues.push("coordinates_of_the_place_of_birth");
  }
  if (!isCoordinate(figure.coordinates_of_the_place_of_death)) {
    issues.push("coordinates_of_the_place_of_death");
  }
  if (
    !Number.isFinite(figure.popularity_rating) ||
    figure.popularity_rating < 0 ||
    figure.popularity_rating > 100
  ) {
    issues.push("popularity_rating");
  }
  if (!isUrl(figure.photo)) issues.push("photo");
  if (isNonEmptyString(figure.source_url) && !isUrl(figure.source_url)) issues.push("source_url");
  const birthYear = historicalYear(figure.birth_date);
  const deathYear = historicalYear(figure.death_date);
  if (birthYear !== null && deathYear !== null && deathYear < birthYear) {
    issues.push("chronology");
  }
  return issues;
}

const aliasesByName = new Map([
  ["genghis khan", ["Chinggis Khan"]],
  ["chinggis khan", ["Genghis Khan"]],
  ["leonardo da vinci", ["Da Vinci", "Leonardo"]],
  ["mahatma gandhi", ["Mohandas Gandhi", "Mohandas Karamchand Gandhi"]],
  ["charlie chaplin", ["Charles Chaplin", "Charles Spencer Chaplin"]],
]);

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_\W]+/g, " ")
    .trim()
    .toLowerCase();
}

function figureId(figure) {
  return normalizeName(`${figure.first_name} ${figure.last_name}`).replace(/\s+/g, "-");
}

function compactFigure(figure) {
  const id = figureId(figure);
  const aliases =
    aliasesByName.get(normalizeName(`${figure.first_name} ${figure.last_name}`)) ?? [];
  return {
    id,
    first_name: figure.first_name,
    last_name: figure.last_name,
    aliases,
    nationality: figure.nationality,
    country_of_origin: figure.country_of_origin,
    flag: figure.flag,
    place_of_birth: figure.place_of_birth,
    coordinates_of_the_place_of_birth: figure.coordinates_of_the_place_of_birth,
    place_of_death: figure.place_of_death,
    coordinates_of_the_place_of_death: figure.coordinates_of_the_place_of_death,
    category: figure.category,
    description: figure.description,
    popularity_rating: figure.popularity_rating,
    photo: figure.photo,
    birth_date: figure.birth_date,
    death_date: figure.death_date,
    source_url:
      figure.source_url ??
      (isNonEmptyString(figure._slug)
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(figure._slug).replace(/%2F/gi, "/")}`
        : `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(
            `${figure.first_name} ${figure.last_name}`.trim(),
          )}`),
    ...(isNonEmptyString(figure.wikidata_id) ? { wikidata_id: figure.wikidata_id } : {}),
  };
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
if (!Array.isArray(source)) {
  throw new Error("Figure dataset must be a JSON array.");
}

const valid = [];
const invalidFields = new Map();
const generatedIds = new Set();
for (const figure of source) {
  const issues = validateFigure(figure);
  const id = figureId(figure);
  if (!id || /^q\d+$/i.test(`${figure.first_name} ${figure.last_name}`.trim())) {
    issues.push("identity");
  }
  if (generatedIds.has(id)) {
    issues.push("duplicate_id");
  }
  if (issues.length === 0) {
    valid.push(compactFigure(figure));
    generatedIds.add(id);
    continue;
  }
  for (const issue of issues) {
    invalidFields.set(issue, (invalidFields.get(issue) ?? 0) + 1);
  }
}

if (valid.length < 5) {
  throw new Error(`Dataset has only ${valid.length} valid figures; at least 5 are required.`);
}

const index = valid.map(
  ({
    id,
    first_name,
    last_name,
    aliases,
    category,
    popularity_rating,
    birth_date,
    death_date,
    place_of_birth,
    coordinates_of_the_place_of_birth,
  }) => ({
    id,
    first_name,
    last_name,
    aliases,
    category,
    popularity_rating,
    birth_date,
    death_date,
    place_of_birth,
    coordinates_of_the_place_of_birth,
  }),
);
const featured = [...valid]
  .sort((left, right) => right.popularity_rating - left.popularity_rating)
  .slice(0, 20)
  .map(
    ({
      id,
      first_name,
      last_name,
      place_of_birth,
      coordinates_of_the_place_of_birth,
      popularity_rating,
      photo,
    }) => ({
      id,
      first_name,
      last_name,
      place_of_birth,
      coordinates_of_the_place_of_birth,
      popularity_rating,
      photo,
    }),
  );
const indexOutput = `${JSON.stringify(index)}\n`;
const featuredOutput = `${JSON.stringify(featured)}\n`;
if (checkOnly) {
  const [currentIndex, currentFeatured] = await Promise.all([
    readFile(indexPath, "utf8").catch(() => ""),
    readFile(featuredPath, "utf8").catch(() => ""),
  ]);
  if (currentIndex !== indexOutput || currentFeatured !== featuredOutput) {
    throw new Error("Generated figure data is stale. Run `pnpm run prepare:data`.");
  }
  for (const figure of valid) {
    const current = await readFile(path.join(recordsDirectory, `${figure.id}.json`), "utf8").catch(
      () => "",
    );
    if (current !== `${JSON.stringify(figure)}\n`) {
      throw new Error(`Generated record is stale: ${figure.id}. Run \`pnpm run prepare:data\`.`);
    }
  }
  const expectedRecordNames = new Set(valid.map((figure) => `${figure.id}.json`));
  const existingRecordNames = await readdir(recordsDirectory).catch(() => []);
  const staleRecord = existingRecordNames.find((name) => !expectedRecordNames.has(name));
  if (staleRecord) {
    throw new Error(
      `Stale generated record exists: ${staleRecord}. Run \`pnpm run prepare:data\`.`,
    );
  }
  if (
    await access(legacyOutputPath)
      .then(() => true)
      .catch(() => false)
  ) {
    throw new Error("Legacy public/data/figures.json still exists. Run `pnpm run prepare:data`.");
  }
} else {
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(recordsDirectory, { recursive: true });
  const expectedRecordNames = new Set(valid.map((figure) => `${figure.id}.json`));
  const existingRecordNames = await readdir(recordsDirectory).catch(() => []);
  const staleRecordNames = existingRecordNames.filter((name) => !expectedRecordNames.has(name));

  const changed = await Promise.all([
    writeIfChanged(indexPath, indexOutput),
    writeIfChanged(featuredPath, featuredOutput),
    ...valid.map((figure) =>
      writeIfChanged(
        path.join(recordsDirectory, `${figure.id}.json`),
        `${JSON.stringify(figure)}\n`,
      ),
    ),
  ]);
  await Promise.all([
    removeGeneratedFile(legacyOutputPath),
    ...staleRecordNames.map((name) => removeGeneratedFile(path.join(recordsDirectory, name))),
  ]);
  console.log(`Generated files updated: ${changed.filter(Boolean).length}.`);
}

const rejected = source.length - valid.length;
const summary = [...invalidFields.entries()]
  .sort((left, right) => right[1] - left[1])
  .map(([field, count]) => `${field}=${count}`)
  .join(", ");
console.log(
  `Figures: ${valid.length} valid, ${rejected} rejected${summary ? ` (${summary})` : ""}.`,
);
