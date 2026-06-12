import type { Coordinates } from "../types/figure";

export type LifeJourneyStop = {
  year: number;
  place: string;
  event: string;
  coordinates: Coordinates;
};

export type LifeJourney = {
  figureId: string;
  sources: string[];
  stops: LifeJourneyStop[];
};

const LIFE_JOURNEYS: Record<string, LifeJourney> = {
  "albert-einstein": {
    figureId: "albert-einstein",
    sources: ["https://en.wikipedia.org/wiki/Albert_Einstein"],
    stops: [
      { year: 1879, place: "Ulm", event: "Born", coordinates: [48.3984, 9.9916] },
      {
        year: 1880,
        place: "Munich",
        event: "Family moved to Munich",
        coordinates: [48.1351, 11.582],
      },
      {
        year: 1896,
        place: "Zürich",
        event: "Entered the Zürich Polytechnic",
        coordinates: [47.3769, 8.5417],
      },
      {
        year: 1902,
        place: "Bern",
        event: "Joined the Swiss Patent Office",
        coordinates: [46.948, 7.4474],
      },
      {
        year: 1914,
        place: "Berlin",
        event: "Joined the Prussian Academy of Sciences",
        coordinates: [52.52, 13.405],
      },
      {
        year: 1933,
        place: "Princeton",
        event: "Settled at the Institute for Advanced Study",
        coordinates: [40.3573, -74.6672],
      },
    ],
  },
  "leonardo-da-vinci": {
    figureId: "leonardo-da-vinci",
    sources: ["https://en.wikipedia.org/wiki/Leonardo_da_Vinci"],
    stops: [
      { year: 1452, place: "Vinci", event: "Born", coordinates: [43.7874, 10.9279] },
      {
        year: 1469,
        place: "Florence",
        event: "Apprenticed in Verrocchio's workshop",
        coordinates: [43.7696, 11.2558],
      },
      {
        year: 1482,
        place: "Milan",
        event: "Entered the service of Ludovico Sforza",
        coordinates: [45.4642, 9.19],
      },
      {
        year: 1500,
        place: "Florence",
        event: "Returned after the fall of Milan",
        coordinates: [43.7696, 11.2558],
      },
      {
        year: 1513,
        place: "Rome",
        event: "Worked under Giuliano de' Medici",
        coordinates: [41.9028, 12.4964],
      },
      {
        year: 1516,
        place: "Amboise",
        event: "Joined the court of Francis I",
        coordinates: [47.413, 0.9827],
      },
    ],
  },
  napoleon: {
    figureId: "napoleon",
    sources: ["https://en.wikipedia.org/wiki/Napoleon"],
    stops: [
      { year: 1769, place: "Ajaccio", event: "Born", coordinates: [41.9192, 8.7386] },
      {
        year: 1793,
        place: "Toulon",
        event: "Rose to prominence during the siege",
        coordinates: [43.1242, 5.928],
      },
      {
        year: 1795,
        place: "Paris",
        event: "Defended the National Convention",
        coordinates: [48.8566, 2.3522],
      },
      {
        year: 1798,
        place: "Cairo",
        event: "Led the French campaign in Egypt",
        coordinates: [30.0444, 31.2357],
      },
      { year: 1805, place: "Milan", event: "Crowned King of Italy", coordinates: [45.4642, 9.19] },
      {
        year: 1812,
        place: "Moscow",
        event: "Reached Moscow during the Russian campaign",
        coordinates: [55.7558, 37.6173],
      },
      { year: 1814, place: "Elba", event: "First exile", coordinates: [42.7782, 10.1927] },
      {
        year: 1815,
        place: "Waterloo",
        event: "Defeated in his final campaign",
        coordinates: [50.6806, 4.4127],
      },
      { year: 1815, place: "Saint Helena", event: "Final exile", coordinates: [-15.965, -5.7089] },
    ],
  },
  "marie-curie": {
    figureId: "marie-curie",
    sources: ["https://en.wikipedia.org/wiki/Marie_Curie"],
    stops: [
      { year: 1867, place: "Warsaw", event: "Born", coordinates: [52.2297, 21.0122] },
      {
        year: 1891,
        place: "Paris",
        event: "Moved to study at the Sorbonne",
        coordinates: [48.8566, 2.3522],
      },
      {
        year: 1903,
        place: "Stockholm",
        event: "Awarded the Nobel Prize in Physics",
        coordinates: [59.3293, 18.0686],
      },
      {
        year: 1911,
        place: "Stockholm",
        event: "Awarded the Nobel Prize in Chemistry",
        coordinates: [59.3293, 18.0686],
      },
      {
        year: 1934,
        place: "Passy",
        event: "Died at the Sancellemoz sanatorium",
        coordinates: [45.9237, 6.6874],
      },
    ],
  },
  "mahatma-gandhi": {
    figureId: "mahatma-gandhi",
    sources: ["https://en.wikipedia.org/wiki/Mahatma_Gandhi"],
    stops: [
      { year: 1869, place: "Porbandar", event: "Born", coordinates: [21.6417, 69.6293] },
      { year: 1888, place: "London", event: "Studied law", coordinates: [51.5074, -0.1278] },
      {
        year: 1893,
        place: "Durban",
        event: "Began working in South Africa",
        coordinates: [-29.8587, 31.0218],
      },
      {
        year: 1903,
        place: "Johannesburg",
        event: "Opened a legal office",
        coordinates: [-26.2041, 28.0473],
      },
      {
        year: 1915,
        place: "Ahmedabad",
        event: "Established a base for the independence movement",
        coordinates: [23.0225, 72.5714],
      },
      {
        year: 1930,
        place: "Dandi",
        event: "Completed the Salt March",
        coordinates: [20.8863, 72.812],
      },
      { year: 1948, place: "New Delhi", event: "Assassinated", coordinates: [28.6139, 77.209] },
    ],
  },
  "ibn-battuta": {
    figureId: "ibn-battuta",
    sources: ["https://en.wikipedia.org/wiki/Ibn_Battuta"],
    stops: [
      { year: 1304, place: "Tangier", event: "Born", coordinates: [35.7595, -5.834] },
      {
        year: 1326,
        place: "Mecca",
        event: "Completed his first pilgrimage",
        coordinates: [21.3891, 39.8579],
      },
      {
        year: 1334,
        place: "Delhi",
        event: "Served at the court of Muhammad bin Tughluq",
        coordinates: [28.6139, 77.209],
      },
      { year: 1345, place: "Quanzhou", event: "Reached China", coordinates: [24.8741, 118.6757] },
      {
        year: 1352,
        place: "Timbuktu",
        event: "Travelled through the Mali Empire",
        coordinates: [16.7666, -3.0026],
      },
      {
        year: 1354,
        place: "Marrakesh",
        event: "Returned to Morocco",
        coordinates: [31.6295, -7.9811],
      },
    ],
  },
  "alexander-von-humboldt": {
    figureId: "alexander-von-humboldt",
    sources: ["https://en.wikipedia.org/wiki/Alexander_von_Humboldt"],
    stops: [
      { year: 1769, place: "Berlin", event: "Born", coordinates: [52.52, 13.405] },
      {
        year: 1794,
        place: "Jena",
        event: "Worked with Goethe and Schiller",
        coordinates: [50.9271, 11.5892],
      },
      {
        year: 1799,
        place: "A Coruña",
        event: "Departed for the Americas",
        coordinates: [43.3623, -8.4115],
      },
      {
        year: 1799,
        place: "Cumaná",
        event: "Began scientific exploration in the Americas",
        coordinates: [10.4635, -64.1775],
      },
      {
        year: 1802,
        place: "Quito",
        event: "Explored the Andes and Chimborazo",
        coordinates: [-0.1807, -78.4678],
      },
      {
        year: 1803,
        place: "Mexico City",
        event: "Studied New Spain",
        coordinates: [19.4326, -99.1332],
      },
      {
        year: 1804,
        place: "Washington, D.C.",
        event: "Met President Thomas Jefferson",
        coordinates: [38.9072, -77.0369],
      },
      {
        year: 1827,
        place: "Berlin",
        event: "Returned permanently to Berlin",
        coordinates: [52.52, 13.405],
      },
    ],
  },
  "charlie-chaplin": {
    figureId: "charlie-chaplin",
    sources: ["https://en.wikipedia.org/wiki/Charlie_Chaplin"],
    stops: [
      { year: 1889, place: "London", event: "Born", coordinates: [51.5074, -0.1278] },
      {
        year: 1910,
        place: "New York",
        event: "Arrived in the United States with a theatre company",
        coordinates: [40.7128, -74.006],
      },
      {
        year: 1913,
        place: "Los Angeles",
        event: "Began his film career",
        coordinates: [34.0522, -118.2437],
      },
      {
        year: 1952,
        place: "Vevey",
        event: "Settled in Switzerland",
        coordinates: [46.4628, 6.8419],
      },
    ],
  },
  "ferdinand-magellan": {
    figureId: "ferdinand-magellan",
    sources: ["https://en.wikipedia.org/wiki/Ferdinand_Magellan"],
    stops: [
      { year: 1480, place: "Sabrosa", event: "Born", coordinates: [41.2672, -7.576] },
      {
        year: 1519,
        place: "Seville",
        event: "Expedition departed Spain",
        coordinates: [37.3891, -5.9845],
      },
      {
        year: 1519,
        place: "Rio de Janeiro",
        event: "Reached the coast of Brazil",
        coordinates: [-22.9068, -43.1729],
      },
      {
        year: 1520,
        place: "Strait of Magellan",
        event: "Navigated the passage into the Pacific",
        coordinates: [-53.1627, -70.9078],
      },
      {
        year: 1521,
        place: "Guam",
        event: "Reached the Mariana Islands",
        coordinates: [13.4443, 144.7937],
      },
      {
        year: 1521,
        place: "Mactan",
        event: "Killed during the Battle of Mactan",
        coordinates: [10.3103, 123.9494],
      },
    ],
  },
  "vasco-da-gama": {
    figureId: "vasco-da-gama",
    sources: ["https://en.wikipedia.org/wiki/Vasco_da_Gama"],
    stops: [
      { year: 1469, place: "Sines", event: "Born", coordinates: [37.9562, -8.8698] },
      {
        year: 1497,
        place: "Lisbon",
        event: "Departed on the first voyage to India",
        coordinates: [38.7223, -9.1393],
      },
      {
        year: 1497,
        place: "Mossel Bay",
        event: "Rounded southern Africa",
        coordinates: [-34.1831, 22.146],
      },
      {
        year: 1498,
        place: "Mombasa",
        event: "Reached the East African coast",
        coordinates: [-4.0435, 39.6682],
      },
      {
        year: 1498,
        place: "Calicut",
        event: "Reached India by sea",
        coordinates: [11.2588, 75.7804],
      },
      {
        year: 1524,
        place: "Kochi",
        event: "Died while serving as viceroy",
        coordinates: [9.9312, 76.2673],
      },
    ],
  },
};

export function getLifeJourney(figureId: string): LifeJourney | null {
  return LIFE_JOURNEYS[figureId] ?? null;
}

export function getLifeJourneys(): LifeJourney[] {
  return Object.values(LIFE_JOURNEYS);
}
