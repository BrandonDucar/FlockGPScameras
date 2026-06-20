<script lang="ts">
  import { onMount } from 'svelte';
  import MapComponent from '$lib/components/Map.svelte';
  import SidebarComponent from '$lib/components/Sidebar.svelte';
  import LegalModalComponent from '$lib/components/LegalModal.svelte';
  import type { CameraLocationSummary } from '@flockgps/shared';

  let locations = $state<CameraLocationSummary[]>([]);
  let selectedCameraId = $state<string | null>(null);
  let submittingCoords = $state<{ lat: number; lng: number } | null>(null);
  let mapboxToken = $state<string>('');
  let disclaimerAccepted = $state(false);
  let currentBounds = $state<any>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  onMount(() => {
    disclaimerAccepted = localStorage.getItem('flockgps_disclaimer_accepted') === 'true';
    mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    
    if (disclaimerAccepted) {
      refreshLocations();
    }
  });

  async function refreshLocations() {
    let url = `${API_URL}/locations/search`;
    if (currentBounds) {
      const ne = currentBounds.getNorthEast();
      const sw = currentBounds.getSouthWest();
      url = `${API_URL}/locations?minLat=${sw.lat}&maxLat=${ne.lat}&minLng=${sw.lng}&maxLng=${ne.lng}`;
    }
    
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        locations = data.locations;
      }
    } catch (e) {
      console.error('Failed to load locations:', e);
    }
  }

  function handleAcceptDisclaimer() {
    localStorage.setItem('flockgps_disclaimer_accepted', 'true');
    disclaimerAccepted = true;
    refreshLocations();
  }

  function handleBoundsChange(bounds: any) {
    currentBounds = bounds;
    refreshLocations();
  }
</script>

{#if !disclaimerAccepted}
  <LegalModalComponent onAccept={handleAcceptDisclaimer} />
{/if}

<main class="app-container">
  <SidebarComponent 
    bind:selectedCameraId
    bind:submittingCoords
    onRefreshLocations={refreshLocations}
    {locations}
  />
  
  {#if mapboxToken}
    <MapComponent
      {locations}
      {mapboxToken}
      onBoundsChange={handleBoundsChange}
      onSelectCamera={(id) => selectedCameraId = id}
      {submittingCoords}
      onSetSubmittingCoords={(coords) => submittingCoords = coords}
    />
  {:else}
    <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #000;">
      <p style="color: #ff5555;">Mapbox access token is missing. Please set VITE_MAPBOX_TOKEN inside your environment settings.</p>
    </div>
  {/if}
</main>
