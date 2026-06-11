import fs from 'fs/promises';
import path from 'path';

const ENDPOINT = 'https://query.wikidata.org/sparql';

const SPORTSPEOPLE_QUERY = `
SELECT DISTINCT ?person ?personLabel ?sitelinks WHERE {
  ?person wdt:P31 wd:Q5;
          wdt:P106/wdt:P279* wd:Q2066131;
          wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks > 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 300
`;

const EXPLORERS_QUERY = `
SELECT DISTINCT ?person ?personLabel ?sitelinks WHERE {
  ?person wdt:P31 wd:Q5;
          wdt:P106/wdt:P279* wd:Q11900058;
          wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 100
`;

async function fetchWikidata(query) {
  console.log('Fetching data from Wikidata...');
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'GuessThePersonBot/1.0 (Contact: local-dev)'
    },
    body: `query=${encodeURIComponent(query)}`
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Wikidata query failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const data = await response.json();
  return Array.from(
    new Map(
      data.results.bindings.map(b => {
        const item = {
          id: b.person.value.split('/').pop(),
          name: b.personLabel.value,
          sitelinks: parseInt(b.sitelinks.value, 10)
        };
        return [item.id, item];
      })
    ).values()
  );
}

async function main() {
  try {
    const dataDir = path.resolve('data');
    await fs.mkdir(dataDir, { recursive: true });

    console.log('Querying Sportspeople...');
    const sportspeople = await fetchWikidata(SPORTSPEOPLE_QUERY);
    await fs.writeFile(path.join(dataDir, 'sportspeople.json'), JSON.stringify(sportspeople, null, 2));
    console.log(`Saved ${sportspeople.length} sportspeople.`);

    console.log('Querying Explorers...');
    const explorers = await fetchWikidata(EXPLORERS_QUERY);
    await fs.writeFile(path.join(dataDir, 'explorers.json'), JSON.stringify(explorers, null, 2));
    console.log(`Saved ${explorers.length} explorers.`);

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
