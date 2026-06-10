export const en = {
  appName: "Figura",
  loadingPhrases: [
    "Charting the known world...",
    "Consulting the stars...",
    "Following the Silk Road...",
    "Mapping forgotten empires...",
    "Tracing ancient routes...",
  ],
  nicknameLabel: "Nickname",
  nicknameHelp: "2-20 chars. Letters, numbers, underscore, hyphen, dot, space.",
  startGame: "Start Game",
  settings: "Settings",
  leaderboard: "Leaderboard",
  home: "Home",
  playAgain: "Play Again",
  changeSettings: "Change Settings",
  round: "Round",
  score: "Score",
  pause: "Pause",
  resume: "Resume",
  leaveGame: "Leave Game",
  resetCompass: "Reset map orientation",
  skipRound: "Skip Round",
  guessLabel: "Guess the historical figure",
  guessPlaceholder: "Type a name...",
  who: "Who is this figure?",
  where: "Where was this figure born?",
  clickBirthplace: "Click the map to place your birthplace guess.",
  extraBank: "Extra Time Bank",
  streak: "Streak",
  inARow: "in a row",
  description: "Description:",
  journeyDistance: "Journey Distance",
  wikipedia: "View on Wikipedia",
  categoriesRequired: "Select at least one category.",
  noLeaderboard: "No scores recorded yet.",
  currentRun: "Current run",
  centuryUnknown: "Century unknown",
  century: (century: number, bc: boolean) =>
    `${century}${ordinalSuffix(century)} c.${bc ? " BC" : ""}`,
};

function ordinalSuffix(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  return value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
}
