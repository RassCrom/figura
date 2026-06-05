export type Coordinates = [lat: number, lng: number];

export type Figure = {
  first_name: string;
  last_name: string;
  nationality: string;
  country_of_origin: string;
  flag: string;
  place_of_birth: string;
  coordinates_of_the_place_of_birth: Coordinates;
  place_of_death: string;
  coordinates_of_the_place_of_death: Coordinates;
  category: string;
  description: string;
  popularity_rating: number;
  photo: string;
  birth_date: string;
  death_date: string;
};

export type Difficulty = "Explorer" | "Scholar" | "Conqueror";

export type Basemap =
  | "Steppe"
  | "OSM"
  | "ESRI Topo"
  | "ESRI Satellite"
  | "CartoDB Dark"
  | "Dark Night Blue"
  | "Historic"
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
  figureName: string;
  score: number;
  hintsUsed: number;
  timeUsed: number;
  category: string;
  continent: Continent;
  correct: boolean;
  firstGuess: boolean;
};

export type AchievementId =
  | "first_blood"
  | "lightning_round"
  | "ice_cold"
  | "around_the_world"
  | "on_fire"
  | "silk_road"
  | "great_khan";

export type PlayerLevel = "Traveler" | "Cartographer" | "Historian" | "Oracle" | "Legend";

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
