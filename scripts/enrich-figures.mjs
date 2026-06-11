import fs from 'fs/promises';
import path from 'path';

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const CATEGORY_EVIDENCE = {
  Sportsperson: /\b(athlete|boxer|footballer|runner|swimmer|martial artist|racing driver|racecar driver|sportsperson|sportsman|sportswoman|cyclist|tennis player|basketball player|baseball player|cricketer|wrestler|skier|gymnast)\b/i,
  Explorer: /\b(explorer|navigator|expedition|voyage|cosmonaut|astronaut)\b/i,
};

async function fetchWikidataBatch(ids) {
  const values = ids.map(id => `wd:${id}`).join(' ');
  const query = `
    SELECT ?person ?article ?countryLabel ?birthPlaceLabel ?birthCoords ?deathPlaceLabel ?deathCoords ?birthDate ?deathDate ?image WHERE {
      VALUES ?person { ${values} }
      
      OPTIONAL { ?person wdt:P27 ?country. }
      OPTIONAL { ?person wdt:P19 ?birthPlace. OPTIONAL { ?birthPlace wdt:P625 ?birthCoords. } }
      OPTIONAL { ?person wdt:P20 ?deathPlace. OPTIONAL { ?deathPlace wdt:P625 ?deathCoords. } }
      OPTIONAL { ?person wdt:P569 ?birthDate. }
      OPTIONAL { ?person wdt:P570 ?deathDate. }
      OPTIONAL { ?person wdt:P18 ?image. }
      
      OPTIONAL {
        ?article schema:about ?person .
        ?article schema:inLanguage "en" .
        ?article schema:isPartOf <https://en.wikipedia.org/> .
      }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const response = await fetch(WIKIDATA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'GuessThePersonBot/1.0'
    },
    body: `query=${encodeURIComponent(query)}`
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Wikidata query failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const data = await response.json();
  const results = {};

  for (const b of data.results.bindings) {
    const id = b.person.value.split('/').pop();
    if (!results[id]) {
      results[id] = {
        id,
        nationalities: new Set(),
        birthPlace: b.birthPlaceLabel ? b.birthPlaceLabel.value : null,
        birthCoords: b.birthCoords ? b.birthCoords.value : null,
        deathPlace: b.deathPlaceLabel ? b.deathPlaceLabel.value : null,
        deathCoords: b.deathCoords ? b.deathCoords.value : null,
        birthDate: b.birthDate ? b.birthDate.value : null,
        deathDate: b.deathDate ? b.deathDate.value : null,
        image: b.image ? b.image.value : null,
        article: b.article ? decodeURIComponent(b.article.value.split('/').pop()) : null,
      };
    }
    if (b.countryLabel) {
      results[id].nationalities.add(b.countryLabel.value);
    }
  }

  // Convert sets to arrays
  for (const id in results) {
    results[id].nationalities = Array.from(results[id].nationalities);
  }

  return Object.values(results);
}

async function fetchWikipediaExtract(title) {
  if (!title) return null;
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json`;
  const response = await fetch(url, { headers: { 'User-Agent': 'GuessThePersonBot/1.0' } });
  if (!response.ok) return null;
  const data = await response.json();
  const pages = data.query.pages;
  const pageId = Object.keys(pages)[0];
  if (pageId === '-1') return null;
  return pages[pageId].extract;
}

function parseCoords(pointString) {
  if (!pointString) return null;
  // "Point(lon lat)"
  const match = pointString.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  if (match) {
    return [parseFloat(match[2]), parseFloat(match[1])]; // [lat, lon]
  }
  return null;
}

function parseDate(dateString) {
  if (!dateString) return null;
  // "1904-04-22T00:00:00Z" -> "1904-04-22"
  return dateString.split('T')[0];
}

async function processCategory(inputFile, categoryName, maxPopularity) {
  const dataPath = path.resolve('data', inputFile);
  const items = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  
  const enriched = [];
  const batchSize = 30; // Wikidata handles 30 easily

  console.log(`Processing ${items.length} items from ${inputFile}...`);
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`  Fetching batch ${i} to ${i + batch.length - 1}...`);
    try {
      const details = await fetchWikidataBatch(batch.map(b => b.id));
      
      for (const item of batch) {
        const detail = details.find(d => d.id === item.id);
        if (!detail) continue;

        // Wikipedia abstract
        const description = await fetchWikipediaExtract(detail.article);

        // Format name
        const nameParts = item.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        // Popularity (0-100 scale based on sitelinks relative to max sitelinks in this dataset type or global max)
        const popularityRating = Math.min(100, Math.round((item.sitelinks / maxPopularity) * 100));

        enriched.push({
          wikidata_id: item.id,
          source_url: detail.article ? `https://en.wikipedia.org/wiki/${encodeURIComponent(detail.article)}` : "",
          first_name: firstName || "",
          last_name: lastName || "",
          nationality: detail.nationalities.join(', ') || "",
          country_of_origin: detail.nationalities[0] || "",
          flag: "", // We can leave this empty or placeholder
          place_of_birth: detail.birthPlace || "",
          coordinates_of_the_place_of_birth: parseCoords(detail.birthCoords) || [],
          place_of_death: detail.deathPlace || "",
          coordinates_of_the_place_of_death: parseCoords(detail.deathCoords) || [],
          category: categoryName,
          description: description || "",
          popularity_rating: popularityRating,
          photo: detail.image || "",
          birth_date: parseDate(detail.birthDate) || "",
          death_date: parseDate(detail.deathDate) || "",
        });
      }
    } catch (e) {
      console.error('Error fetching batch:', e.message);
    }
  }

  return enriched;
}

function isValidGameFigure(figure) {
  // Same validation logic as prepare-figures.mjs
  const requiredStrings = [
    "first_name", "nationality", "country_of_origin", "place_of_birth", 
    "place_of_death", "category", "description", "birth_date", "death_date"
  ];
  for (const field of requiredStrings) {
    if (typeof figure[field] !== 'string' || figure[field].trim() === '') return false;
  }
  if (typeof figure.last_name !== 'string') return false;
  
  const isCoord = (c) => Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'number';
  if (!isCoord(figure.coordinates_of_the_place_of_birth)) return false;
  if (!isCoord(figure.coordinates_of_the_place_of_death)) return false;
  
  if (typeof figure.popularity_rating !== 'number') return false;
  if (!figure.photo || !figure.photo.startsWith('http')) return false;

  return true;
}

async function main() {
  try {
    const sportspeople = await processCategory('sportspeople.json', 'Sportsperson', 200); // 200 sitelinks max for sport
    const explorers = await processCategory('explorers.json', 'Explorer', 150); // 150 sitelinks max for explorer

    const allNewFigures = [...sportspeople, ...explorers];

    const gameReady = [];
    const presentFigures = [];

    for (const f of allNewFigures) {
      const evidence = CATEGORY_EVIDENCE[f.category];
      if (evidence && !evidence.test(f.description)) {
        console.warn(`Skipping ${f.first_name} ${f.last_name}: no ${f.category} evidence.`);
        continue;
      }
      if (!f.death_date || !f.place_of_death || f.coordinates_of_the_place_of_death.length !== 2) {
        presentFigures.push(f);
      } else if (isValidGameFigure(f)) {
        gameReady.push(f);
      }
    }

    console.log(`\nResults:`);
    console.log(`- Game Ready (Historical): ${gameReady.length}`);
    console.log(`- Present/Living/Incomplete: ${presentFigures.length}`);

    // Read existing game figures
    const existingFiguresPath = path.resolve('src', 'data', 'figures.json');
    let existingFigures = [];
    try {
      existingFigures = JSON.parse(await fs.readFile(existingFiguresPath, 'utf8'));
    } catch {
      console.log('No existing figures.json found, creating new one.');
    }

    const existingIds = new Set(
      existingFigures.map(f => f.wikidata_id).filter(Boolean)
    );
    const existingNames = new Set(
      existingFigures.map(f => `${f.first_name} ${f.last_name}`.trim().toLocaleLowerCase())
    );
    const uniqueGameReady = gameReady.filter(f => {
      const name = `${f.first_name} ${f.last_name}`.trim().toLocaleLowerCase();
      if (existingIds.has(f.wikidata_id) || existingNames.has(name)) return false;
      existingIds.add(f.wikidata_id);
      existingNames.add(name);
      return true;
    });
    const updatedGameFigures = [...existingFigures, ...uniqueGameReady];
    await fs.writeFile(existingFiguresPath, JSON.stringify(updatedGameFigures, null, 2));
    console.log(`Updated src/data/figures.json (now has ${updatedGameFigures.length} figures).`);

    // Write present figures to a separate file
    const presentPath = path.resolve('src', 'data', 'figures_present.json');
    await fs.writeFile(presentPath, JSON.stringify(presentFigures, null, 2));
    console.log(`Saved living/incomplete figures to src/data/figures_present.json`);

  } catch (err) {
    console.error('Main error:', err);
  }
}

main();
