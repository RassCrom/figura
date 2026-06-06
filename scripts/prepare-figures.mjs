import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "src", "data", "figures.json");
const outputPath = path.join(root, "public", "data", "figures.json");
const checkOnly = process.argv.includes("--check");

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
    new URL(value);
    return true;
  } catch {
    return false;
  }
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
  return issues;
}

function compactFigure(figure) {
  return {
    first_name: figure.first_name,
    last_name: figure.last_name,
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
  };
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
if (!Array.isArray(source)) {
  throw new Error("Figure dataset must be a JSON array.");
}

const valid = [];
const invalidFields = new Map();
for (const figure of source) {
  const issues = validateFigure(figure);
  if (issues.length === 0) {
    valid.push(compactFigure(figure));
    continue;
  }
  for (const issue of issues) {
    invalidFields.set(issue, (invalidFields.get(issue) ?? 0) + 1);
  }
}

if (valid.length < 5) {
  throw new Error(`Dataset has only ${valid.length} valid figures; at least 5 are required.`);
}

const output = `${JSON.stringify(valid)}\n`;
if (checkOnly) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== output) {
    throw new Error("Generated figure dataset is stale. Run `pnpm run prepare:data`.");
  }
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
}

const rejected = source.length - valid.length;
const summary = [...invalidFields.entries()]
  .sort((left, right) => right[1] - left[1])
  .map(([field, count]) => `${field}=${count}`)
  .join(", ");
console.log(
  `Figures: ${valid.length} valid, ${rejected} rejected${summary ? ` (${summary})` : ""}.`,
);
