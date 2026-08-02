export function formatYear(year: number): string {
  if (year < 0) {
    return `${Math.abs(year)} av. J.-C.`;
  }
  return `an ${year}`;
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

  const label = document.createElement('div');
  label.className = 'timeline-label';

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

  container.append(label, slider);
  onChange(Number(slider.value));
  return container;
}
