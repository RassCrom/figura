import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourcePath = path.join(process.cwd(), "src", "data", "figures.json");
const leaderMinimumPopularity = 70;
const categoryNames = new Map(
  Object.entries({
    Sportsperson: [
    "Alexander Alekhine",
    "Alfredo Di Stefano",
    "Ayrton Senna",
    "Babe Didrikson Zaharias",
    "Bobby Charlton",
    "Bobby Fischer",
    "Boris Spassky",
    "Bud Spencer",
    "Cesare Maldini",
    "Don Bradman",
    "Emanuel Lasker",
    "Eusebio",
    "Francisco Gento",
    "Frank Williams",
    "Franz Beckenbauer",
    "George Best",
    "Gerd Muller",
    "Giuseppe Farina",
    "Gunnar Nordahl",
    "Joan Gamper",
    "Johan Cruyff",
    "Jose Raul Capablanca",
    "Josef Bican",
    "Juan Manuel Fangio",
    "Just Fontaine",
    "Mikhail Tal",
    "Morihei Ueshiba",
    "Mario Zagallo",
    "Niki Lauda",
    "O. J. Simpson",
    "Paul Newman",
    "Santiago Bernabeu Yeste",
    "Sandor Kocsis",
    "Socrates",
    "Tigran Petrosian",
    "Wilhelm Steinitz",
    ],
    Explorer: [
      "Alexander von Humboldt",
      "Alfred Russel Wallace",
      "Ed White",
      "Gene Cernan",
      "John Glenn",
      "John Young",
      "Michael Collins",
      "Pete Conrad",
      "Piri Reis",
      "William Anders",
    ],
    Scientist: [
      "A. P. J. Abdul Kalam",
      "Bronislaw Malinowski",
      "Claude Levi-Strauss",
      "Emile Durkheim",
      "Ferdinand Porsche",
      "Ferdinand von Zeppelin",
      "Georg Simmel",
      "Max Weber",
      "Mileva Maric",
      "Pierre Bourdieu",
      "Robert K. Merton",
    ],
    Writer: [
      "Bertha von Suttner",
      "Helen Keller",
      "Helena Blavatsky",
      "Noah Webster",
      "Stan Lee",
      "T. E. Lawrence",
      "Theodor Mommsen",
    ],
    Artist: [
      "Anna Pavlova",
      "Christian Dior",
      "Guccio Gucci",
      "Hans Holbein the Younger",
      "Jean Arp",
      "Josephine Baker",
      "Karl Lagerfeld",
      "M. C. Escher",
      "Pierre Cardin",
      "Robin Williams",
      "Victor Vasarely",
      "Yves Saint Laurent",
    ],
    Philosopher: [
      "Abu Hanifa",
      "Al-Shafi'i",
      "Albertus Magnus",
      "Ambrose",
      "Anselm of Canterbury",
      "Georg Simmel",
      "Gregory of Nyssa",
      "Jan Hus",
      "Jerome",
      "John Calvin",
      "Justin Martyr",
      "Marcus Aurelius",
      "Peter Kropotkin",
      "Philip Melanchthon",
      "Theodor W. Adorno",
    ],
  }).map(([category, names]) => [category, new Set(names.map(normalizeName))]),
);

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

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const recategorized = new Map();
const rebalanced = [];
const removedLeaders = [];

for (const figure of source) {
  const name = normalizeName(fullName(figure));
  for (const [category, names] of categoryNames) {
    if (!names.has(name)) continue;
    if (figure.category !== category) {
      recategorized.set(category, (recategorized.get(category) ?? 0) + 1);
      figure.category = category;
    }
    break;
  }

  if (figure.category === "Leader" && figure.popularity_rating < leaderMinimumPopularity) {
    removedLeaders.push(figure);
    continue;
  }

  rebalanced.push(figure);
}

const sportsCount = rebalanced.filter((figure) => figure.category === "Sportsperson").length;
if (sportsCount < 40) {
  throw new Error(`Rebalance produced only ${sportsCount} sportspersons; at least 40 are required.`);
}

await writeFile(sourcePath, `${JSON.stringify(rebalanced, null, 2)}\n`);

console.log(
  `Recategorized figures: ${[...recategorized.entries()]
    .map(([category, count]) => `${category}=${count}`)
    .join(", ")}.`,
);
console.log(`Sportspersons after rebalance: ${sportsCount}.`);
console.log(
  `Removed leaders below popularity ${leaderMinimumPopularity}: ${removedLeaders.length}.`,
);
console.log(`Figures after rebalance: ${rebalanced.length}.`);
