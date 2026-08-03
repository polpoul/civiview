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
const MIN_RADIUS_KM = 5;
const KM_PER_DEG_LAT = 111.32;
const BLOB_POINTS = 14;
const FILL_OPACITY = 0.5;
const HOVER_FILL_OPACITY = 0.75;

function colorForCivilisation(civilisation: string): string {
  let hash = 0;
  for (let i = 0; i < civilisation.length; i++) {
    hash = (hash << 5) - hash + civilisation.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 50%)`;
}

// PRNG déterministe (mulberry32) : la forme générée pour un événement est stable d'un chargement à l'autre.
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function closeRing(ring: number[][]): number[][] {
  const [firstLon, firstLat] = ring[0];
  const [lastLon, lastLat] = ring[ring.length - 1];
  if (firstLon !== lastLon || firstLat !== lastLat) {
    return [...ring, ring[0]];
  }
  return ring;
}

// Forme organique par défaut : un polygone irrégulier centré sur `lieu`, dont la surface approche `etendue`.
// Si `event.territoire` est fourni, il est utilisé tel quel à la place (contour précis).
function outerRingForEvent(event: CivilizationEvent): number[][] {
  if (event.territoire && event.territoire.length >= 3) {
    return closeRing(event.territoire.map((p) => [p.lon, p.lat]));
  }

  const areaKm2 = event.etendue ?? DEFAULT_ETENDUE_KM2;
  const radiusKm = Math.max(MIN_RADIUS_KM, Math.sqrt(areaKm2 / Math.PI));
  const { lat, lon } = event.lieu;
  const latRad = (lat * Math.PI) / 180;
  const random = mulberry32(hashString(event.id));

  const ring: number[][] = [];
  for (let i = 0; i < BLOB_POINTS; i++) {
    const angle = (i / BLOB_POINTS) * Math.PI * 2;
    const variation = 0.65 + random() * 0.7;
    const r = radiusKm * variation;
    const dLat = (r * Math.cos(angle)) / KM_PER_DEG_LAT;
    const dLon = (r * Math.sin(angle)) / (KM_PER_DEG_LAT * Math.cos(latRad));
    ring.push([lon + dLon, lat + dLat]);
  }
  ring.push(ring[0]);
  return ring;
}

// Anneau extérieur + trous (GeoJSON : le premier anneau est le contour, les suivants sont des exclusions).
function polygonCoordinatesForEvent(event: CivilizationEvent): number[][][] {
  const outer = outerRingForEvent(event);
  const holes = (event.exclusions ?? []).map((exclusion) =>
    closeRing(exclusion.map((p) => [p.lon, p.lat])),
  );
  return [outer, ...holes];
}

function formatEventDate(event: CivilizationEvent): string {
  const debut = formatYear(parseInt(event.dateDebut, 10));
  if (event.dateFin === undefined) {
    return debut;
  }
  return `${debut} – ${formatYear(parseInt(event.dateFin, 10))}`;
}

const TIMELINE_MIN_YEAR = -12000;
const FILL_LAYER = 'civilizations-fill';
const OUTLINE_LAYER = 'civilizations-outline';
const LABEL_LAYER = 'civilizations-label';

// Durée (en années) de la transition d'apparition/disparition progressive avant dateDebut
// et après dateFin : le territoire grandit depuis un point, puis rétrécit vers ce même point.
const FADE_YEARS = 80;

interface PreparedEvent {
  properties: Record<string, string>;
  baseRings: number[][][];
  center: [number, number];
  dateDebut: number;
  dateFin: number | undefined;
}

// 0 en dehors de la fenêtre [dateDebut-FADE_YEARS, dateFin+FADE_YEARS], 1 pendant la période active,
// et une interpolation linéaire pendant les transitions d'entrée/sortie.
function computeScale(year: number, dateDebut: number, dateFin: number | undefined): number {
  if (year < dateDebut) {
    const dt = dateDebut - year;
    return dt > FADE_YEARS ? 0 : 1 - dt / FADE_YEARS;
  }
  if (dateFin !== undefined && year > dateFin) {
    const dt = year - dateFin;
    return dt > FADE_YEARS ? 0 : 1 - dt / FADE_YEARS;
  }
  return 1;
}

// Rapproche chaque point du centre (`lieu`) proportionnellement à `scale` : à scale=1 la forme est
// intacte, à scale=0 elle est réduite à un point.
function scaleRing(ring: number[][], center: [number, number], scale: number): number[][] {
  const [cx, cy] = center;
  return ring.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
}

function buildFeatureCollection(prepared: PreparedEvent[], year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const event of prepared) {
    const scale = computeScale(year, event.dateDebut, event.dateFin);
    if (scale <= 0) {
      continue;
    }
    features.push({
      type: 'Feature',
      properties: event.properties,
      geometry: {
        type: 'Polygon',
        coordinates: event.baseRings.map((ring) => scaleRing(ring, event.center, scale)),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

map.on('load', () => {
  const civEvents = events as CivilizationEvent[];
  const eventYears = civEvents.flatMap((event) => {
    const debut = parseInt(event.dateDebut, 10);
    const fin = event.dateFin === undefined ? undefined : parseInt(event.dateFin, 10);
    return fin === undefined ? [debut] : [debut, fin];
  });
  const currentYear = new Date().getFullYear();
  const minYear = TIMELINE_MIN_YEAR;
  const maxYear = Math.max(currentYear, ...eventYears);
  // Par défaut, on se place à la dernière date couverte par les données pour que tout soit visible.
  const initialYear = Math.max(...eventYears);

  const prepared: PreparedEvent[] = civEvents.map((event) => ({
    properties: {
      civilisation: event.civilisation,
      color: colorForCivilisation(event.civilisation),
      dateLabel: formatEventDate(event),
      lieu: event.lieu.nom,
      evenement: event.evenement,
      action: event.action,
    },
    baseRings: polygonCoordinatesForEvent(event),
    center: [event.lieu.lon, event.lieu.lat],
    dateDebut: parseInt(event.dateDebut, 10),
    dateFin: event.dateFin === undefined ? undefined : parseInt(event.dateFin, 10),
  }));

  map.addSource('civilizations', {
    type: 'geojson',
    data: buildFeatureCollection(prepared, initialYear),
    generateId: true,
  });

  map.addLayer({
    id: FILL_LAYER,
    type: 'fill',
    source: 'civilizations',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        HOVER_FILL_OPACITY,
        FILL_OPACITY,
      ],
    },
  });

  map.addLayer({
    id: OUTLINE_LAYER,
    type: 'line',
    source: 'civilizations',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
    },
  });

  // Nom de la civilisation centré sur son territoire (MapLibre place le label automatiquement
  // au point le plus "central" du polygone, même pour des formes concaves).
  map.addLayer({
    id: LABEL_LAYER,
    type: 'symbol',
    source: 'civilizations',
    layout: {
      'text-field': ['get', 'civilisation'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-max-width': 8,
    },
    paint: {
      'text-color': '#1f2937',
      'text-halo-color': 'rgba(255, 255, 255, 0.85)',
      'text-halo-width': 1.2,
    },
  });

  let hoveredFeatureId: number | string | undefined;

  map.on('mousemove', FILL_LAYER, (e) => {
    map.getCanvas().style.cursor = 'pointer';
    if (!e.features?.length) {
      return;
    }
    const featureId = e.features[0].id;
    if (hoveredFeatureId !== undefined && hoveredFeatureId !== featureId) {
      map.setFeatureState({ source: 'civilizations', id: hoveredFeatureId }, { hover: false });
    }
    hoveredFeatureId = featureId;
    map.setFeatureState({ source: 'civilizations', id: hoveredFeatureId }, { hover: true });
  });

  map.on('mouseleave', FILL_LAYER, () => {
    map.getCanvas().style.cursor = '';
    if (hoveredFeatureId !== undefined) {
      map.setFeatureState({ source: 'civilizations', id: hoveredFeatureId }, { hover: false });
    }
    hoveredFeatureId = undefined;
  });

  const popup = new maplibregl.Popup({ offset: 12 });

  map.on('click', FILL_LAYER, (e) => {
    const feature = e.features?.[0];
    if (!feature) {
      return;
    }
    const p = feature.properties as Record<string, string>;
    popup
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>${p.civilisation}</strong> — ${p.lieu}<br/>
        <em>${p.dateLabel}</em><br/>
        <p>${p.evenement}</p>
        <p>${p.action}</p>
      `)
      .addTo(map);
  });

  const source = map.getSource('civilizations') as maplibregl.GeoJSONSource;

  function applyYear(year: number): void {
    source.setData(buildFeatureCollection(prepared, year));
  }

  const timeline = createTimeline({
    minYear,
    maxYear,
    initialYear,
    onChange: applyYear,
  });
  document.body.appendChild(timeline);
});
