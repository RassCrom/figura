import { en } from "../../i18n/en";
import { getFullName } from "../../lib/figures";
import type { Figure } from "../../types/figure";

const MIN_TIMELINE_YEAR = -3000;
const MAX_TIMELINE_YEAR = new Date().getUTCFullYear();

function formatHistoricalYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year}`;
}

type Props = {
  figure: Figure;
  birthYearEstimate: number;
  deathYearEstimate: number;
  playing: boolean;
  onBirthYearChange: (year: number) => void;
  onDeathYearChange: (year: number) => void;
};

export function ReversePanel({
  figure,
  birthYearEstimate,
  deathYearEstimate,
  playing,
  onBirthYearChange,
  onDeathYearChange,
}: Props) {
  return (
    <>
      <div className="reverse-prompt">
        <img src={figure.photo} alt="" />
        <div>
          <strong>{getFullName(figure)}</strong>
          <span>Estimate their lifetime, then {en.clickBirthplace.toLowerCase()}</span>
        </div>
      </div>
      <div className="reverse-timeline" role="group" aria-label="Lifetime estimate">
        <div className="reverse-year-field">
          <label htmlFor="birth-year-estimate">
            <span>Birth estimate</span>
            <strong>{formatHistoricalYear(birthYearEstimate)}</strong>
          </label>
          <input
            id="birth-year-estimate"
            type="number"
            min={MIN_TIMELINE_YEAR}
            max={MAX_TIMELINE_YEAR}
            step="1"
            value={birthYearEstimate}
            onChange={(event) => onBirthYearChange(Number(event.target.value))}
            disabled={!playing}
          />
        </div>
        <input
          aria-label="Birth estimate slider"
          type="range"
          min={MIN_TIMELINE_YEAR}
          max={MAX_TIMELINE_YEAR}
          step="1"
          value={birthYearEstimate}
          onChange={(event) => onBirthYearChange(Number(event.target.value))}
          disabled={!playing}
        />
        <div className="reverse-year-field">
          <label htmlFor="death-year-estimate">
            <span>Death estimate</span>
            <strong>{formatHistoricalYear(deathYearEstimate)}</strong>
          </label>
          <input
            id="death-year-estimate"
            type="number"
            min={MIN_TIMELINE_YEAR}
            max={MAX_TIMELINE_YEAR}
            step="1"
            value={deathYearEstimate}
            onChange={(event) => onDeathYearChange(Number(event.target.value))}
            disabled={!playing}
          />
        </div>
        <input
          aria-label="Death estimate slider"
          type="range"
          min={MIN_TIMELINE_YEAR}
          max={MAX_TIMELINE_YEAR}
          step="1"
          value={deathYearEstimate}
          onChange={(event) => onDeathYearChange(Number(event.target.value))}
          disabled={!playing}
        />
        <div className="timeline-scale" aria-hidden="true">
          <span>Use negative years for BC</span>
          <span>Present</span>
        </div>
      </div>
    </>
  );
}
