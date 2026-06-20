<script lang="ts">
  import mapboxgl from 'mapbox-gl';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import type { CameraLocationSummary } from '@flockgps/shared';

  let {
    locations,
    mapboxToken,
    onBoundsChange,
    onSelectCamera,
    submittingCoords,
    onSetSubmittingCoords
  } = $props<{
    locations: CameraLocationSummary[];
    mapboxToken: string;
    onBoundsChange?: (bounds: mapboxgl.LngLatBounds) => void;
    onSelectCamera?: (id: string) => void;
    submittingCoords: { lat: number; lng: number } | null;
    onSetSubmittingCoords?: (coords: { lat: number; lng: number } | null) => void;
  }>();

  let mapContainer = $state<HTMLDivElement | null>(null);
  let map = $state<mapboxgl.Map | null>(null);
  let submitMarker = $state<mapboxgl.Marker | null>(null);
  let mapLoaded = $state(false);

  // Effect to initialize the map
  $effect(() => {
    if (!mapContainer) return;

    mapboxgl.accessToken = mapboxToken;

    const m = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/dark-v11', // High-fidelity dark mode
      center: [-98.5795, 39.8283], // US center
      zoom: 4,
    });

    map = m;

    m.on('load', () => {
      mapLoaded = true;

      // Add cluster images / layer templates
      m.addSource('locations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster circle layer
      m.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'locations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#6366f1', // Indigo for low count
            10,
            '#a855f7', // Purple for medium
            50,
            '#ec4899', // Pink for high
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            10,
            24,
            50,
            30,
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.2)',
        },
      });

      // Cluster count text
      m.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'locations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Individual unclustered point layer
      m.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'locations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'status'],
            'verified', '#10b981',
            'unverified', '#f59e0b',
            'disputed', '#ef4444',
            '#64748b'
          ],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Cluster clicks
      m.on('click', 'clusters', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = m.getSource('locations') as mapboxgl.GeoJSONSource;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const coordinates = (features[0].geometry as any).coordinates;
          m.easeTo({
            center: coordinates,
            zoom: zoom || 10,
          });
        });
      });

      // Point clicks
      m.on('click', 'unclustered-point', (e) => {
        const properties = e.features?.[0]?.properties;
        if (properties && onSelectCamera) {
          onSelectCamera(properties.id);
        }
      });

      // Change cursor on hover
      m.on('mouseenter', 'clusters', () => m.getCanvas().style.cursor = 'pointer');
      m.on('mouseleave', 'clusters', () => m.getCanvas().style.cursor = '');
      m.on('mouseenter', 'unclustered-point', () => m.getCanvas().style.cursor = 'pointer');
      m.on('mouseleave', 'unclustered-point', () => m.getCanvas().style.cursor = '');

      // Trigger bounds change immediately on load
      const bounds = m.getBounds();
      if (onBoundsChange && bounds) {
        onBoundsChange(bounds);
      }
    });

    m.on('moveend', () => {
      const bounds = m.getBounds();
      if (onBoundsChange && bounds) {
        onBoundsChange(bounds);
      }
    });

    // Map click for submitting custom coordinates
    m.on('click', (e) => {
      // Ensure we are in submission mode and click wasn't on a marker/cluster
      const features = m.queryRenderedFeatures(e.point, {
        layers: ['clusters', 'unclustered-point']
      });

      if (features.length === 0 && onSetSubmittingCoords) {
        const { lng, lat } = e.lngLat;
        onSetSubmittingCoords({ lat, lng });
      }
    });

    return () => {
      m.remove();
    };
  });

  // Effect to update data source when locations change
  $effect(() => {
    if (!map || !mapLoaded) return;

    const source = map.getSource('locations') as mapboxgl.GeoJSONSource;
    if (!source) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: locations.map(loc => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [loc.lng, loc.lat]
        },
        properties: {
          id: loc.id,
          status: loc.status,
          cameraType: loc.cameraType,
          confidenceScore: loc.confidenceScore,
          city: loc.city,
          state: loc.state,
        }
      }))
    };

    source.setData(geojson);
  });

  // Effect to sync coordinate selection pin
  $effect(() => {
    if (!map || !mapLoaded) return;

    if (!submittingCoords) {
      if (submitMarker) {
        submitMarker.remove();
        submitMarker = null;
      }
      return;
    }

    if (submitMarker) {
      submitMarker.setLngLat([submittingCoords.lng, submittingCoords.lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.backgroundColor = '#a855f7'; // Purple pin for user submission
      el.style.border = '2px solid white';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.8)';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([submittingCoords.lng, submittingCoords.lat])
        .addTo(map);

      submitMarker = marker;
    }
  });
</script>

<div class="map-viewport">
  <div bind:this={mapContainer} style="width: 100%; height: 100%;"></div>
  <button 
    type="button"
    class="legal-floating-badge" 
    onclick={() => {
      localStorage.removeItem('flockgps_disclaimer_accepted');
      window.location.reload();
    }}
  >
    🛡️ Legal Disclaimer
  </button>
</div>
