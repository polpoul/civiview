export function formatYear(year: number): string {
  if (year < 0) {
    return `${Math.abs(year)} av. J.-C.`;
  }
  return `an ${year}`;
}

interface HistoricalPeriod {
  label: string;
  start: number;
  end: number;
  color: string;
}

// Périodisation classique de l'histoire (repères larges, pas de frontière universelle exacte).
const HISTORICAL_PERIODS: HistoricalPeriod[] = [
  { label: 'Préhistoire', start: -Infinity, end: -3300, color: '#8d6e63' },
  { label: 'Antiquité', start: -3300, end: 476, color: '#d4a017' },
  { label: 'Moyen Âge', start: 476, end: 1492, color: '#64748b' },
  { label: 'Époque moderne', start: 1492, end: 1789, color: '#2563eb' },
  { label: 'Époque contemporaine', start: 1789, end: Infinity, color: '#16a34a' },
];

function buildPeriodsGradient(minYear: number, maxYear: number): string {
  const span = maxYear - minYear;
  const stops: string[] = [];
  for (const period of HISTORICAL_PERIODS) {
    const start = Math.max(period.start, minYear);
    const end = Math.min(period.end, maxYear);
    if (end <= start) {
      continue;
    }
    const startPct = ((start - minYear) / span) * 100;
    const endPct = ((end - minYear) / span) * 100;
    stops.push(`${period.color} ${startPct}%`, `${period.color} ${endPct}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function createLegend(minYear: number, maxYear: number): HTMLDivElement {
  const legend = document.createElement('div');
  legend.className = 'timeline-legend';
  for (const period of HISTORICAL_PERIODS) {
    if (period.end <= minYear || period.start >= maxYear) {
      continue;
    }
    const item = document.createElement('span');
    item.className = 'timeline-legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'timeline-legend-swatch';
    swatch.style.backgroundColor = period.color;
    item.append(swatch, document.createTextNode(period.label));
    legend.appendChild(item);
  }
  return legend;
}

export interface TimelineOptions {
  minYear: number;
  maxYear: number;
  initialYear: number;
  onChange: (year: number) => void;
}

export function createTimeline({ minYear, maxYear, initialYear, onChange }: TimelineOptions): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'timeline';

  const row = document.createElement('div');
  row.className = 'timeline-row';

  const label = document.createElement('div');
  label.className = 'timeline-label';

  const track = document.createElement('div');
  track.className = 'timeline-track';

  const periods = document.createElement('div');
  periods.className = 'timeline-periods';
  periods.style.background = buildPeriodsGradient(minYear, maxYear);

  track.append(periods);

  if (minYear < 0 && maxYear > 0) {
    const zeroMark = document.createElement('div');
    zeroMark.className = 'timeline-zero-mark';
    zeroMark.title = 'An 0';
    zeroMark.style.left = `${((0 - minYear) / (maxYear - minYear)) * 100}%`;
    track.appendChild(zeroMark);
  }

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'timeline-slider';
  slider.min = String(minYear);
  slider.max = String(maxYear);
  // Pas d'un an : évite tout arrondi du curseur qui masquerait des événements proches de maxYear.
  slider.step = '1';
  slider.value = String(initialYear);

  label.textContent = formatYear(Number(slider.value));

  slider.addEventListener('input', () => {
    const year = Number(slider.value);
    label.textContent = formatYear(year);
    onChange(year);
  });

  track.append(slider);
  row.append(label, track);
  container.append(row, createLegend(minYear, maxYear));
  onChange(Number(slider.value));
  return container;
}
