/**
 * The XP ring.
 *
 * A server component — it takes numbers and renders SVG, with no state and no
 * interaction, so shipping JavaScript for it would buy nothing. The sweep still
 * animates because the CSS transition on `stroke-dashoffset` runs on first
 * paint.
 */
const SIZE = 108;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function XpRing({
  percent,
  level,
  xp,
  xpToNext,
  levelTitle,
}: {
  percent: number;
  level: number;
  xp: number;
  xpToNext: number | null;
  levelTitle: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  return (
    <div className="me-ring">
      <div className="me-ring__wrap">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Level ${level}, ${clamped}% of the way to the next level`}
        >
          <circle
            className="me-ring__track"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />
          <circle
            className="me-ring__fill"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="me-ring__centre" aria-hidden>
          <span className="me-ring__num">{level}</span>
          <span className="me-ring__label">Level</span>
        </div>
      </div>

      <div className="me-ring__next">
        <b>{xp.toLocaleString("en-NG")} XP</b> · {levelTitle}
        <br />
        {xpToNext === null ? (
          <>Top level reached. 🏆</>
        ) : (
          <>
            <b>{xpToNext.toLocaleString("en-NG")}</b> more to Level {level + 1}
          </>
        )}
      </div>
    </div>
  );
}
