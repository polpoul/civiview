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

map.on('load', () => {
  for (const event of events as CivilizationEvent[]) {
    const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
      <strong>${event.civilisation}</strong> — ${event.lieu.nom}<br/>
      <em>${event.date}</em><br/>
      <p>${event.evenement}</p>
      <p>${event.action}</p>
    `);

    new maplibregl.Marker()
      .setLngLat([event.lieu.lon, event.lieu.lat])
      .setPopup(popup)
      .addTo(map);
  }
});
