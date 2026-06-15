export type Coordinates = [lat: number, lng: number];

export type Figure = {
  id: string;
  first_name: string;
  last_name: string;
  aliases: string[];
  nationality: string;
  country_of_origin: string;
  flag: string;
  place_of_birth: string;
  coordinates_of_the_place_of_birth: Coordinates;
  place_of_death: string | null;
  coordinates_of_the_place_of_death: Coordinates | null;
  category: string;
  description: string;
  popularity_rating: number;
  photo: string;
  birth_date: string;
  death_date: string | null;
  is_living?: boolean;
  source_url?: string;
  wikidata_id?: string;
};

export type Difficulty = "Explorer" | "Scholar" | "Conqueror";
export type GameMode = "classic" | "daily" | "reverse";

export type FigureIndex = Pick<
  Figure,
  | "id"
  | "first_name"
  | "last_name"
  | "aliases"
  | "category"
  | "popularity_rating"
  | "birth_date"
  | "death_date"
  | "is_living"
  | "place_of_birth"
  | "coordinates_of_the_place_of_birth"
>;

export type FeaturedFigure = Pick<
  Figure,
  | "id"
  | "first_name"
  | "last_name"
  | "place_of_birth"
  | "coordinates_of_the_place_of_birth"
  | "popularity_rating"
  | "photo"
>;

export type Basemap =
  | "Steppe"
  | "OSM"
  | "ESRI Topo"
  | "ESRI Satellite"
  | "CartoDB Dark"
  | "Dark Night Blue"
  | "Historic"
  | "Medivial"
  | "Custom Vector";

export type Continent =
  | "Africa"
  | "Asia"
  | "Europe"
  | "North America"
  | "Oceania"
  | "South America"
  | "Unknown";

export type RoundResult = {
  round: number;
  figureId: string;
  figureName: string;
  score: number;
  /** Wrong name submissions this round (drives the score penalty). */
  wrongGuesses: number;
  /** Field-note hints revealed this round (initial / description / category). */
  hintsUsed: number;
  timeUsed: number;
  extraUsed: number;
  category: string;
  continent: Continent;
  correct: boolean;
  firstGuess: boolean;
  distanceKm?: number;
  guessCoordinates?: Coordinates;
  birthYearError?: number;
  deathYearError?: number;
  locationScore?: number;
  speedScore?: number;
};

export type AchievementId =
  | "first_blood"
  | "lightning_round"
  | "ice_cold"
  | "around_the_world"
  | "on_fire"
  | "silk_road"
  | "great_khan"
  | "collector_10"
  | "collector_50"
  | "collector_100"
  | "veteran_25"
  | "veteran_100"
  | "daily_7"
  | "daily_30"
  | "category_ace";

export type PlayerLevel =
  | "Traveler"
  | "Cartographer"
  | "Historian"
  | "Oracle"
  | "Legend"
  | "Pathfinder"
  | "Luminary"
  | "Worldseer"
  | "Immortal";

export type LeaderboardEntry = {
  id: string;
  nickname: string;
  score: number;
  difficulty: Difficulty;
  categories: string[];
  levelName?: PlayerLevel;
  achievements?: AchievementId[];
  date: string;
  current?: boolean;
};
