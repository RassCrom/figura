import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourcePath = path.join(process.cwd(), "src", "data", "figures.json");
const endpoint = "https://query.wikidata.org/sparql";
const curated = [
  { id: "Q17515", name: "Diego Maradona", sitelinks: 174 },
  { id: "Q25369", name: "Kobe Bryant", sitelinks: 114 },
  { id: "Q16397", name: "Bruce Lee", sitelinks: 162 },
  { id: "Q52651", name: "Jesse Owens", sitelinks: 96 },
  { id: "Q167828", name: "Lev Yashin", sitelinks: 88 },
  { id: "Q482931", name: "Ferenc Puskas", sitelinks: 94 },
  { id: "Q180642", name: "Garrincha", sitelinks: 79 },
];

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_\W]+/g, " ")
    .trim()
    .toLowerCase();
}

function parseCoordinates(value) {
  const match = value?.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  return match ? [Number(match[2]), Number(match[1])] : [];
}

function parseDate(value) {
  return value?.split("T")[0] ?? "";
}

const values = curated.map(({ id }) => `wd:${id}`).join(" ");
const query = `
SELECT ?person ?personLabel ?article ?countryLabel ?birthPlaceLabel ?birthCoords
       ?deathPlaceLabel ?deathCoords ?birthDate ?deathDate ?image WHERE {
  VALUES ?person { ${values} }
  OPTIONAL { ?person wdt:P27 ?country. }
  OPTIONAL { ?person wdt:P19 ?birthPlace. OPTIONAL { ?birthPlace wdt:P625 ?birthCoords. } }
  OPTIONAL { ?person wdt:P20 ?deathPlace. OPTIONAL { ?deathPlace wdt:P625 ?deathCoords. } }
  OPTIONAL { ?person wdt:P569 ?birthDate. }
  OPTIONAL { ?person wdt:P570 ?deathDate. }
  OPTIONAL { ?person wdt:P18 ?image. }
  OPTIONAL {
    ?article schema:about ?person;
             schema:inLanguage "en";
             schema:isPartOf <https://en.wikipedia.org/>.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Accept: "application/sparql-results+json",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "GuessThePersonBot/1.0",
  },
  body: `query=${encodeURIComponent(query)}`,
});
if (!response.ok) throw new Error(`Wikidata query failed: ${response.status}`);

const bindings = (await response.json()).results.bindings;
const details = new Map();
for (const binding of bindings) {
  const id = binding.person.value.split("/").pop();
  const current = details.get(id) ?? { nationalities: new Set() };
  if (binding.countryLabel) current.nationalities.add(binding.countryLabel.value);
  for (const [field, key] of [
    ["name", "personLabel"],
    ["article", "article"],
    ["birthPlace", "birthPlaceLabel"],
    ["birthCoords", "birthCoords"],
    ["deathPlace", "deathPlaceLabel"],
    ["deathCoords", "deathCoords"],
    ["birthDate", "birthDate"],
    ["deathDate", "deathDate"],
    ["image", "image"],
  ]) {
    if (!current[field] && binding[key]) current[field] = binding[key].value;
  }
  details.set(id, current);
}

async function descriptionFor(articleUrl) {
  const title = decodeURIComponent(articleUrl.split("/").pop());
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    titles: title,
    format: "json",
  });
  const result = await fetch(url, { headers: { "User-Agent": "GuessThePersonBot/1.0" } });
  if (!result.ok) return "";
  const pages = (await result.json()).query.pages;
  return Object.values(pages)[0]?.extract ?? "";
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const existingIds = new Set(source.map((figure) => figure.wikidata_id).filter(Boolean));
const existingNames = new Set(
  source.map((figure) => normalizeName(`${figure.first_name} ${figure.last_name}`)),
);
const added = [];

for (const item of curated) {
  if (existingIds.has(item.id) || existingNames.has(normalizeName(item.name))) continue;
  const detail = details.get(item.id);
  if (!detail?.article) continue;
  const description = await descriptionFor(detail.article);
  const parts = item.name.split(" ");
  const figure = {
    first_name: parts.shift() ?? "",
    last_name: parts.join(" "),
    nationality: [...detail.nationalities].join(", "),
    country_of_origin: [...detail.nationalities][0] ?? "",
    flag: "",
    place_of_birth: detail.birthPlace ?? "",
    coordinates_of_the_place_of_birth: parseCoordinates(detail.birthCoords),
    place_of_death: detail.deathPlace ?? "",
    coordinates_of_the_place_of_death: parseCoordinates(detail.deathCoords),
    category: "Sportsperson",
    description,
    popularity_rating: Math.min(99, Math.round((item.sitelinks / 200) * 100)),
    photo: detail.image ?? "",
    birth_date: parseDate(detail.birthDate),
    death_date: parseDate(detail.deathDate),
    source_url: detail.article,
    wikidata_id: item.id,
  };
  const required = [
    figure.first_name,
    figure.nationality,
    figure.country_of_origin,
    figure.place_of_birth,
    figure.place_of_death,
    figure.description,
    figure.photo,
    figure.birth_date,
    figure.death_date,
  ];
  if (
    required.every((value) => value) &&
    figure.coordinates_of_the_place_of_birth.length === 2 &&
    figure.coordinates_of_the_place_of_death.length === 2
  ) {
    source.push(figure);
    added.push(item.name);
  }
}

await writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
console.log(`Added curated sportspersons: ${added.length} (${added.join(", ")}).`);
