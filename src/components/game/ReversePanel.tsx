import { en } from "../../i18n/en";
import { getFullName } from "../../lib/figures";
import type { Figure } from "../../types/figure";

type Props = {
  figure: Figure;
  birthYearEstimate: number | null;
  deathYearEstimate: number | null;
  showDateInputs: boolean;
  datesRequired: boolean;
  validationMessage: string | null;
  playing: boolean;
  onBirthYearChange: (year: number | null) => void;
  onDeathYearChange: (year: number | null) => void;
};

export function ReversePanel({
  figure,
  birthYearEstimate,
  deathYearEstimate,
  showDateInputs,
  datesRequired,
  validationMessage,
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
          <span>
            {showDateInputs
              ? `Enter their lifetime, then ${en.clickBirthplace.toLowerCase()}`
              : en.clickBirthplace}
          </span>
        </div>
      </div>
      {showDateInputs ? (
        <div className="reverse-timeline" role="group" aria-label="Lifetime estimate">
          <div className="reverse-year-field">
            <label htmlFor="birth-year-estimate">
              Birth year {datesRequired ? "(required)" : "(optional)"}
            </label>
            <input
              id="birth-year-estimate"
              type="number"
              step="1"
              value={birthYearEstimate ?? ""}
              placeholder="e.g. 1815"
              onChange={(event) =>
                onBirthYearChange(event.target.value === "" ? null : Number(event.target.value))
              }
              disabled={!playing}
              required={datesRequired}
            />
          </div>
          <div className="reverse-year-field">
            <label htmlFor="death-year-estimate">
              Death year {datesRequired ? "(required)" : "(optional)"}
            </label>
            <input
              id="death-year-estimate"
              type="number"
              step="1"
              value={deathYearEstimate ?? ""}
              placeholder="e.g. 1852"
              onChange={(event) =>
                onDeathYearChange(event.target.value === "" ? null : Number(event.target.value))
              }
              disabled={!playing}
              required={datesRequired}
            />
          </div>
          <small className="reverse-date-help">
            Use negative years for BC. Dates are feedback only and do not affect points.
          </small>
          {validationMessage ? (
            <small className="reverse-date-error" role="alert">
              {validationMessage}
            </small>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
