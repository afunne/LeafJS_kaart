const kmlFile = 'pathtoschoolfromhome.kml';
const tokenStorageKey = 'mapbox-public-token';
const tokenForm = document.querySelector('#token-form');
const tokenInput = document.querySelector('#token-input');
const status = document.querySelector('#mapbox-status');
const actions = document.querySelector('.mapbox-actions');
let map;
let routeData;

tokenInput.value = localStorage.getItem(tokenStorageKey) || '';
if (tokenInput.value) initializeMap(tokenInput.value);

tokenForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) return;
  localStorage.setItem(tokenStorageKey, token);
  initializeMap(token);
});

document.querySelector('#clear-token').addEventListener('click', () => {
  localStorage.removeItem(tokenStorageKey);
  tokenInput.value = '';
  actions.hidden = true;
  status.textContent = 'Token eemaldatud. Sisesta enda token kaardi käivitamiseks.';
  if (map) { map.remove(); map = undefined; }
});

function initializeMap(token) {
  if (map) map.remove();
  mapboxgl.accessToken = token;
  map = new mapboxgl.Map({ container: 'mapbox-map', style: 'mapbox://styles/mapbox/streets-v12', center: [24.86, 59.453], zoom: 13 });
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
  map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');
  map.on('load', loadKmlData);
  map.on('error', (event) => { if (event.error?.status === 401) status.textContent = 'Token ei ole kehtiv või sellel puudub juurdepääs.'; });
  status.textContent = 'Kaart laadib KML-andmeid...';
}

function loadKmlData() {
  fetch(kmlFile)
    .then((response) => { if (!response.ok) throw new Error(`KML-faili laadimine ebaõnnestus: ${response.status}`); return response.text(); })
    .then((kmlText) => {
      const document = new DOMParser().parseFromString(kmlText, 'application/xml');
      if (document.querySelector('parsererror')) throw new Error('KML-faili vorming ei ole korrektne.');
      const featureCollection = parseKml(document);
      routeData = featureCollection;
      map.addSource('kml-route', { type: 'geojson', data: featureCollection });
      map.addLayer({ id: 'kml-route-line', type: 'line', source: 'kml-route', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#e56b3f', 'line-width': 5, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'kml-route-points', type: 'circle', source: 'kml-route', filter: ['==', '$type', 'Point'], paint: { 'circle-color': '#286451', 'circle-radius': 8, 'circle-stroke-color': '#fffdf7', 'circle-stroke-width': 2 } });
      ['kml-route-line', 'kml-route-points'].forEach((layerId) => {
        map.on('click', layerId, showPopup);
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      });
      map.fitBounds(getBounds(featureCollection), { padding: 70, maxZoom: 15 });
      actions.hidden = false;
      status.textContent = `${featureCollection.features.length} KML-objekti on kaardil.`;
    })
    .catch((error) => { status.textContent = error.message; console.error(error); });
}

function parseKml(document) {
  const features = [];
  [...document.getElementsByTagNameNS('*', 'Placemark')].forEach((placemark) => {
    const name = placemark.getElementsByTagNameNS('*', 'name')[0]?.textContent.trim() || 'KML objekt';
    const lineString = placemark.getElementsByTagNameNS('*', 'LineString')[0];
    const point = placemark.getElementsByTagNameNS('*', 'Point')[0];
    if (lineString) features.push({ type: 'Feature', properties: { name }, geometry: { type: 'LineString', coordinates: readCoordinates(lineString) } });
    if (point) features.push({ type: 'Feature', properties: { name }, geometry: { type: 'Point', coordinates: readCoordinates(point)[0] } });
  });
  return { type: 'FeatureCollection', features };
}

function readCoordinates(element) {
  return element.getElementsByTagNameNS('*', 'coordinates')[0].textContent.trim().split(/\s+/).map((coordinate) => {
    const [longitude, latitude] = coordinate.split(',').map(Number);
    return [longitude, latitude];
  });
}

function getBounds(featureCollection) {
  const bounds = new mapboxgl.LngLatBounds();
  featureCollection.features.forEach((feature) => {
    const coordinates = feature.geometry.type === 'Point' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    coordinates.forEach((coordinate) => bounds.extend(coordinate));
  });
  return bounds;
}

function showPopup(event) {
  new mapboxgl.Popup().setLngLat(event.lngLat).setHTML(`<strong>${event.features[0].properties.name}</strong>`).addTo(map);
}

document.querySelector('#fit-route').addEventListener('click', () => {
  if (map && routeData) map.fitBounds(getBounds(routeData), { padding: 70, maxZoom: 15 });
});

document.querySelector('#toggle-route').addEventListener('click', (event) => {
  const hidden = map.getLayoutProperty('kml-route-line', 'visibility') === 'none';
  map.setLayoutProperty('kml-route-line', 'visibility', hidden ? 'visible' : 'none');
  map.setLayoutProperty('kml-route-points', 'visibility', hidden ? 'visible' : 'none');
  event.currentTarget.textContent = hidden ? 'Peida marsruut' : 'Näita marsruuti';
});