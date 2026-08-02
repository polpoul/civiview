import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import events from './data/events.sample.json';
import type { CivilizationEvent } from './types';

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

function colorForCivilisation(civilisation: string): string {
  let hash = 0;
  for (let i = 0; i < civilisation.length; i++) {
    hash = (hash << 5) - hash + civilisation.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 50%)`;
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

map.on('load', () => {
  for (const event of events as CivilizationEvent[]) {
    const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
      <strong>${event.civilisation}</strong> — ${event.lieu.nom}<br/>
      <em>${event.date}</em><br/>
      <p>${event.evenement}</p>
      <p>${event.action}</p>
    `);

    const element = createMarkerElement(event.civilisation);
    scalableMarkers.push({
      element,
      baseRadius: radiusForEtendue(event.etendue ?? DEFAULT_ETENDUE_KM2),
    });

    new maplibregl.Marker({ element })
      .setLngLat([event.lieu.lon, event.lieu.lat])
      .setPopup(popup)
      .addTo(map);
  }

  applyZoomScale();
  map.on('zoom', applyZoomScale);
});
