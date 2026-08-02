import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import events from './data/events.sample.json';
import type { CivilizationEvent } from './types';
import { createTimeline, formatYear } from './timeline';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [20, 20],
  zoom: 2,
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const DEFAULT_ETENDUE_KM2 = 10_000;
const REFERENCE_ETENDUE_KM2 = 10_000;
const REFERENCE_RADIUS_PX = 14;
const MIN_RADIUS_PX = 6;
const MAX_RADIUS_PX = 48;

// Rayon proportionnel à sqrt(étendue) : la SURFACE du disque représente l'étendue de la civilisation.
function radiusForEtendue(etendue: number): number {
  const scaled = REFERENCE_RADIUS_PX * Math.sqrt(etendue / REFERENCE_ETENDUE_KM2);
  return Math.min(MAX_RADIUS_PX, Math.max(MIN_RADIUS_PX, scaled));
}

const REFERENCE_ZOOM = 2;
// Fraction de l'échelle de zoom appliquée à la taille des disques : 0 = taille fixe à l'écran,
// 1 = taille proportionnelle au terrain (comme les tuiles). On reste entre les deux.
const ZOOM_SIZE_INFLUENCE = 0.35;

function zoomScaleFactor(zoom: number): number {
  return Math.pow(2, (zoom - REFERENCE_ZOOM) * ZOOM_SIZE_INFLUENCE);
}

const MARKER_ALPHA = 0.5;

// MapLibre applique un style inline `opacity: 1` sur l'élément du marqueur (prioritaire sur le CSS),
// donc la transparence doit être portée par la couleur elle-même plutôt que par la propriété opacity.
function colorForCivilisation(civilisation: string): string {
  let hash = 0;
  for (let i = 0; i < civilisation.length; i++) {
    hash = (hash << 5) - hash + civilisation.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 50% / ${MARKER_ALPHA})`;
}

function createMarkerElement(civilisation: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'civ-marker';
  el.style.backgroundColor = colorForCivilisation(civilisation);
  return el;
}

interface ScalableMarker {
  element: HTMLDivElement;
  baseRadius: number;
  dateDebut: number;
  /** Absent = événement ponctuel : reste visible indéfiniment une fois apparu. */
  dateFin: number | undefined;
}

const scalableMarkers: ScalableMarker[] = [];

function applyZoomScale(): void {
  const scale = zoomScaleFactor(map.getZoom());
  for (const { element, baseRadius } of scalableMarkers) {
    const diameter = baseRadius * 2 * scale;
    element.style.width = `${diameter}px`;
    element.style.height = `${diameter}px`;
  }
}

// Les civilisations apparaissent quand le curseur atteint leur dateDebut, et disparaissent
// après leur dateFin si elle est renseignée (sinon elles restent visibles indéfiniment).
function applyYearFilter(currentYear: number): void {
  for (const { element, dateDebut, dateFin } of scalableMarkers) {
    const visible = dateDebut <= currentYear && (dateFin === undefined || currentYear <= dateFin);
    element.style.display = visible ? '' : 'none';
  }
}

function formatEventDate(event: CivilizationEvent): string {
  const debut = formatYear(parseInt(event.dateDebut, 10));
  if (event.dateFin === undefined) {
    return debut;
  }
  return `${debut} – ${formatYear(parseInt(event.dateFin, 10))}`;
}

const TIMELINE_MIN_YEAR = -12000;

map.on('load', () => {
  const civEvents = events as CivilizationEvent[];
  const eventYears = civEvents.flatMap((event) => {
    const debut = parseInt(event.dateDebut, 10);
    const fin = event.dateFin === undefined ? undefined : parseInt(event.dateFin, 10);
    return fin === undefined ? [debut] : [debut, fin];
  });
  // Le curseur couvre toute l'histoire jusqu'à aujourd'hui, avec un début fixe.
  const currentYear = new Date().getFullYear();
  const minYear = TIMELINE_MIN_YEAR;
  const maxYear = Math.max(currentYear, ...eventYears);
  // Par défaut, on se place à la dernière date couverte par les données pour que tout soit visible.
  const initialYear = Math.max(...eventYears);

  for (const event of civEvents) {
    const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
      <strong>${event.civilisation}</strong> — ${event.lieu.nom}<br/>
      <em>${formatEventDate(event)}</em><br/>
      <p>${event.evenement}</p>
      <p>${event.action}</p>
    `);

    const element = createMarkerElement(event.civilisation);
    scalableMarkers.push({
      element,
      baseRadius: radiusForEtendue(event.etendue ?? DEFAULT_ETENDUE_KM2),
      dateDebut: parseInt(event.dateDebut, 10),
      dateFin: event.dateFin === undefined ? undefined : parseInt(event.dateFin, 10),
    });

    new maplibregl.Marker({ element })
      .setLngLat([event.lieu.lon, event.lieu.lat])
      .setPopup(popup)
      .addTo(map);
  }

  applyZoomScale();
  map.on('zoom', applyZoomScale);

  const timeline = createTimeline({
    minYear,
    maxYear,
    initialYear,
    onChange: applyYearFilter,
  });
  document.body.appendChild(timeline);
});
