const kmlFile = 'pathtoschoolfromhome.kml';
const map = L.map('map');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const clickPopup = L.popup();
map.on('click', (event) => {
  clickPopup
    .setLatLng(event.latlng)
    .setContent('You clicked the map at ' + event.latlng.toString())
    .openOn(map);
});

fetch(kmlFile)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`KML-faili laadimine ebaõnnestus: ${response.status}`);
    }
    return response.text();
  })
  .then((kmlText) => {
    const kmlDocument = new DOMParser().parseFromString(kmlText, 'application/xml');
    const parseError = kmlDocument.querySelector('parsererror');
    if (parseError) {
      throw new Error('KML-faili vorming ei ole korrektne.');
    }

    const placemarks = [...kmlDocument.getElementsByTagNameNS('*', 'Placemark')];
    const mapLayers = [];

    placemarks.forEach((placemark) => {
      const name = placemark.getElementsByTagNameNS('*', 'name')[0]?.textContent.trim() || 'KML objekt';
      const lineString = placemark.getElementsByTagNameNS('*', 'LineString')[0];
      const point = placemark.getElementsByTagNameNS('*', 'Point')[0];

      if (lineString) {
        const coordinates = readCoordinates(lineString);
        const route = L.polyline(coordinates, {
          color: '#286451',
          weight: 5,
          opacity: 0.9
        }).bindPopup(`<b>${name}</b>`).addTo(map);
        mapLayers.push(route);
      }

      if (point) {
        const [latitude, longitude] = readCoordinates(point)[0];
        const marker = L.marker([latitude, longitude])
          .bindPopup(`<b>${name}</b>`)
          .addTo(map);
        mapLayers.push(marker);

        if (name.toLowerCase().includes('kose tee')) {
          L.circle([latitude, longitude], {
            color: '#b96518',
            fillColor: '#e28a2b',
            fillOpacity: 0.38,
            radius: 130
          }).bindPopup(`<b>${name}</b><br>Kodukoha kujund.`).addTo(map);
        }
      }
    });

    if (mapLayers.length > 0) {
      map.fitBounds(L.featureGroup(mapLayers).getBounds(), {padding: [24, 24]});
    }
  })
  .catch((error) => console.error(error));

function readCoordinates(element) {
  const coordinatesElement = element.getElementsByTagNameNS('*', 'coordinates')[0];
  return coordinatesElement.textContent.trim().split(/\s+/).map((coordinate) => {
    const [longitude, latitude] = coordinate.split(',').map(Number);
    return [latitude, longitude];
  });
}
