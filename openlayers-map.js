const {
  Feature,
  Map,
  Overlay,
  View,
  TileLayer,
  VectorLayer,
  OSM,
  VectorSource,
  KML,
  Point,
  CircleGeom,
  fromLonLat,
  Zoom,
  FullScreen,
  ScaleLine,
  CircleStyle,
  Fill,
  Icon,
  Stroke,
  Style
} = {
  Feature: ol.Feature,
  Map: ol.Map,
  Overlay: ol.Overlay,
  View: ol.View,
  TileLayer: ol.layer.Tile,
  VectorLayer: ol.layer.Vector,
  OSM: ol.source.OSM,
  VectorSource: ol.source.Vector,
  KML: ol.format.KML,
  Point: ol.geom.Point,
  CircleGeom: ol.geom.Circle,
  fromLonLat: ol.proj.fromLonLat,
  Zoom: ol.control.Zoom,
  FullScreen: ol.control.FullScreen,
  ScaleLine: ol.control.ScaleLine,
  CircleStyle: ol.style.Circle,
  Fill: ol.style.Fill,
  Icon: ol.style.Icon,
  Stroke: ol.style.Stroke,
  Style: ol.style.Style
};

const kmlFile = 'pathtoschoolfromhome.kml';
const homeIconSource = '.vscode/images/home.png';
const schoolIconSource = '.vscode/images/graduate.png';

const kmlSource = new VectorSource();

const kmlLayer = new VectorLayer({
  source: kmlSource,
  style: (feature) => {
    const geometryType = feature.getGeometry().getType();
    if (geometryType.includes('Line')) {
      return new Style({
        stroke: new Stroke({color: '#d65f3c', width: 5})
      });
    }
    const name = feature.get('name')?.toLowerCase() || '';
    return iconMarkerStyle(name.includes('kose tee') ? homeIconSource : schoolIconSource);
  }
});
const extraSource = new VectorSource();
const extraLayer = new VectorLayer({source: extraSource});

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({source: new OSM()}),
    kmlLayer,
    extraLayer
  ],
  controls: [new Zoom(), new FullScreen(), new ScaleLine()],
  view: new View({center: fromLonLat([24.8, 59.43]), zoom: 12})
});

const popupElement = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popup = new Overlay({
  element: popupElement,
  autoPan: {animation: {duration: 200}},
  positioning: 'bottom-center',
  offset: [0, -12]
});
map.addOverlay(popup);

document.getElementById('popup-close').addEventListener('click', () => {
  popup.setPosition(undefined);
  popupElement.hidden = true;
});

let kmlProcessed = false;
kmlSource.on('change', () => {
  if (kmlProcessed || kmlSource.getFeatures().length === 0) {
    return;
  }
  kmlProcessed = true;

  const features = kmlSource.getFeatures();
  const homeFeature = findFeature(features, 'kose tee');
  const schoolFeature = findFeature(features, 'tallinn industrial education center');

  if (homeFeature) {
    const homePoint = new Point(homeFeature.getGeometry().getCoordinates());
    extraSource.addFeature(new Feature({geometry: new CircleGeom(homePoint.getCoordinates(), 130)}));
    extraSource.addFeature(new Feature({geometry: homePoint, name: 'Kodukoht: Kose tee'}));
  }

  if (schoolFeature) {
    extraSource.addFeature(new Feature({
      geometry: new Point(schoolFeature.getGeometry().getCoordinates()),
      name: 'Kool: Tallinn Industrial Education Center'
    }));
  }

  extraLayer.setStyle((feature) => {
    if (feature.get('name') === 'Kodukoht: Kose tee') {
      return iconMarkerStyle(homeIconSource);
    }
    if (feature.get('name')?.startsWith('Kool:')) {
      return iconMarkerStyle(schoolIconSource);
    }
    return new Style({
      fill: new Fill({color: 'rgba(226, 138, 43, 0.22)'}),
      stroke: new Stroke({color: '#b96518', width: 2})
    });
  });

  const extent = kmlSource.getExtent();
  if (extent.every(Number.isFinite)) {
    map.getView().fit(extent, {padding: [40, 40, 40, 40], maxZoom: 16});
  }
});

fetch(kmlFile)
  .then((response) => response.text())
  .then((kmlText) => {
    const kmlDocument = new DOMParser().parseFromString(kmlText, 'application/xml');
    const parsedFeatures = new KML({
      extractStyles: false,
      showPointNames: false,
      iconUrlFunction: () => homeIconSource
    })
      .readFeatures(kmlText, {featureProjection: map.getView().getProjection()});
    if (kmlSource.getFeatures().length === 0) {
      kmlSource.addFeatures(parsedFeatures);
    }
    const routeCoordinates = [...kmlDocument.getElementsByTagNameNS('*', 'LineString')]
      .flatMap((line) => line.getElementsByTagNameNS('*', 'coordinates')[0].textContent.trim().split(/\s+/))
      .map((coordinate) => coordinate.split(',').map(Number));
    const routeDistance = routeCoordinates.slice(1).reduce((total, coordinate, index) => {
      return total + distanceBetween(routeCoordinates[index], coordinate);
    }, 0);
    document.getElementById('distance-control').textContent =
      `Teekonna pikkus: ${formatDistance(routeDistance)}`;
  })
  .catch(() => {
    document.getElementById('distance-control').textContent = 'Teekonna pikkus: ei saa arvutada';
  });

map.on('singleclick', (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, (candidate) => candidate);
  if (!feature) {
    popup.setPosition(undefined);
    popupElement.hidden = true;
    return;
  }

  const name = feature.get('name') || 'KML objekt';
  const distance = feature.get('distance');
  popupContent.textContent = distance ? `${name} · ${distance}` : name;
  popup.setPosition(event.coordinate);
  popupElement.hidden = false;
});

function findFeature(features, searchText) {
  return features.find((feature) => {
    const name = feature.get('name');
    return typeof name === 'string' && name.toLowerCase().includes(searchText);
  });
}

function iconMarkerStyle(source) {
  return [
    new Style({
      image: new CircleStyle({
        radius: 23,
        fill: new Fill({color: '#286451'}),
        stroke: new Stroke({color: '#fff', width: 4})
      })
    }),
    new Style({
      image: new Icon({src: source, scale: 0.075, anchor: [0.5, 0.5]})
    })
  ];
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

function distanceBetween(firstCoordinate, secondCoordinate) {
  const earthRadius = 6371008.8;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const longitudeDifference = toRadians(secondCoordinate[0] - firstCoordinate[0]);
  const latitudeDifference = toRadians(secondCoordinate[1] - firstCoordinate[1]);
  const firstLatitude = toRadians(firstCoordinate[1]);
  const secondLatitude = toRadians(secondCoordinate[1]);
  const value = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude)
    * Math.sin(longitudeDifference / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
