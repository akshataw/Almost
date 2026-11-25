/**
 * Decorative poster pattern for the landing page.
 * One dot is very slightly larger — a quiet hint of what the game is.
 */
export function HeroPattern() {
  const cols = 9;
  const rows = 9;
  const gap = 40;
  const odd = { c: 6, r: 2 };
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isOdd = c === odd.c && r === odd.r;
      dots.push(
        <circle
          key={`${c}-${r}`}
          cx={gap / 2 + c * gap}
          cy={gap / 2 + r * gap}
          r={isOdd ? 9.6 : 8.4}
          className={isOdd ? "fill-paper transition-colors duration-700 group-hover:fill-anomaly" : "fill-paper"}
          opacity={1 - (r + c) * 0.035}
        />,
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${cols * gap} ${rows * gap}`}
      className="group h-auto w-full max-w-[200px] sm:max-w-[360px]"
      role="img"
      aria-label="A grid of identical dots. Or is it?"
    >
      {dots}
    </svg>
  );
}
