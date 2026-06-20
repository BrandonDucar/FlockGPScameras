<script lang="ts">
  import { onMount } from 'svelte';
  import type { CameraLocationSummary, CameraType, LocationStatus } from '@flockgps/shared';
  import confetti from 'canvas-confetti';

  let {
    selectedCameraId = $bindable(),
    submittingCoords = $bindable(),
    onRefreshLocations,
    locations
  } = $props<{
    selectedCameraId: string | null;
    submittingCoords: { lat: number; lng: number } | null;
    onRefreshLocations: () => void;
    locations: CameraLocationSummary[];
  }>();

  // Search and Filters
  let searchQuery = $state('');
  let typeFilter = $state<string>('');
  let statusFilter = $state<string>('');
  
  // Selected Camera Detailed View
  let cameraDetails = $state<any | null>(null);
  let loadingDetails = $state(false);

  // Submission Form State
  let cameraType = $state<'alpr' | 'traffic' | 'fixed' | 'mobile' | 'unknown'>('alpr');
  let description = $state('');
  let submitterNotes = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  // Voting Status
  let voting = $state(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Watch selectedCameraId to fetch fresh details
  $effect(() => {
    if (selectedCameraId) {
      fetchCameraDetails(selectedCameraId);
    } else {
      cameraDetails = null;
    }
  });

  async function fetchCameraDetails(id: string) {
    loadingDetails = true;
    try {
      const res = await fetch(`${API_URL}/locations/search?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        cameraDetails = data.location;
      }
    } catch (e) {
      console.error('Error fetching details:', e);
    } finally {
      loadingDetails = false;
    }
  }

  // Handle camera voting (upvote/downvote)
  async function handleVote(isUpvote: boolean) {
    if (!selectedCameraId || voting) return;
    voting = true;
    errorMessage = null;

    try {
      const res = await fetch(`${API_URL}/locations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedCameraId,
          isUpvote
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification submit failed');
      }

      // Success confetti on positive feedback
      if (isUpvote) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 }
        });
      }

      // Refetch info
      await fetchCameraDetails(selectedCameraId);
      onRefreshLocations();
    } catch (err: any) {
      errorMessage = err.message || 'Failed to submit vote';
    } finally {
      voting = false;
    }
  }

  // Handle reporting
  async function handleReport() {
    if (!selectedCameraId || voting) return;
    voting = true;
    errorMessage = null;

    try {
      const res = await fetch(`${API_URL}/locations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedCameraId,
          isReport: true,
          reportReason: 'Camera location seems missing or incorrect'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Report submit failed');
      }

      alert('Location successfully reported for review.');
      await fetchCameraDetails(selectedCameraId);
      onRefreshLocations();
    } catch (err: any) {
      errorMessage = err.message || 'Failed to file report';
    } finally {
      voting = false;
    }
  }

  // Form Submit
  async function handleSubmitCamera(e: Event) {
    e.preventDefault();
    if (!submittingCoords || isSubmitting) return;

    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    try {
      const res = await fetch(`${API_URL}/locations/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: submittingCoords.lat,
          lng: submittingCoords.lng,
          cameraType,
          description: description || undefined,
          notes: submitterNotes || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Submission failed');
      }

      successMessage = 'Camera location reported successfully! Our verification system will index it.';
      
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.5 }
      });

      // Clear state
      submittingCoords = null;
      description = '';
      submitterNotes = '';
      
      onRefreshLocations();
    } catch (err: any) {
      errorMessage = err.message || 'Submission failed';
    } finally {
      isSubmitting = false;
    }
  }

  // Filter local location lists
  let filteredLocations = $derived.by(() => {
    return locations.filter(loc => {
      const matchesSearch = searchQuery === '' || 
        (loc.city?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (loc.state?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (loc.cameraType?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === '' || loc.cameraType === typeFilter;
      const matchesStatus = statusFilter === '' || loc.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  });
</script>

<div class="sidebar glass">
  <!-- Header Banner -->
  <div class="sidebar-header">
    <div class="logo-area">
      <span class="logo-radar">📡</span>
      <h1>FlockGPS<span>cameras</span></h1>
    </div>
    <p class="subtitle">Crowdsourced US ALPR Locator Network</p>
  </div>

  <div class="sidebar-scrollable">
    <!-- Camera details panel -->
    {#if cameraDetails}
      <div class="section camera-details-panel">
        <button class="back-btn" onclick={() => selectedCameraId = null}>
          ← Back to Search
        </button>

        <div class="details-card">
          <div class="details-row">
            <span class="badge badge-{cameraDetails.status}">{cameraDetails.status}</span>
            <span class="type-tag">{cameraDetails.cameraType}</span>
          </div>

          <h2 class="camera-title">
            {#if cameraDetails.city}
              {cameraDetails.city}, {cameraDetails.state}
            {:else}
              Camera Pin ({cameraDetails.lat.toFixed(5)}, {cameraDetails.lng.toFixed(5)})
            {/if}
          </h2>

          <div class="stats-grid">
            <div class="stat-box">
              <span class="stat-val">{cameraDetails.confidenceScore}%</span>
              <span class="stat-lbl">Confidence</span>
            </div>
            <div class="stat-box">
              <span class="stat-val">{cameraDetails.upvotes}</span>
              <span class="stat-lbl">Upvotes</span>
            </div>
            <div class="stat-box">
              <span class="stat-val">{cameraDetails.reportsCount}</span>
              <span class="stat-lbl">Flags</span>
            </div>
          </div>

          {#if cameraDetails.description}
            <div class="details-desc">
              <strong>Location Description:</strong>
              <p>{cameraDetails.description}</p>
            </div>
          {/if}

          <!-- Verification interface -->
          <div class="verify-controls">
            <h3>Verify Location Accuracy</h3>
            <p class="verify-helper">Help confirm if this camera is currently active here.</p>
            
            <div class="vote-buttons">
              <button 
                class="vote-btn upvote" 
                disabled={voting} 
                onclick={() => handleVote(true)}
              >
                👍 Active (Confirm)
              </button>
              <button 
                class="vote-btn downvote" 
                disabled={voting} 
                onclick={() => handleVote(false)}
              >
                👎 Downvote
              </button>
            </div>

            <button 
              class="flag-btn" 
              disabled={voting} 
              onclick={handleReport}
            >
              🚩 Report Missing or Incorrect
            </button>
          </div>
        </div>
      </div>

    <!-- Submit new camera panel -->
    {:else if submittingCoords}
      <div class="section submit-form-panel">
        <button class="back-btn" onclick={() => submittingCoords = null}>
          ✕ Cancel Submission
        </button>

        <form onsubmit={handleSubmitCamera} class="submit-form">
          <h2>Submit New Camera</h2>
          <p class="submit-helper">Select type and fill details for coordinates dropped on map.</p>

          <div class="form-group coord-preview">
            <label for="coordinates">Coordinates</label>
            <input 
              id="coordinates"
              type="text" 
              readonly 
              value="{submittingCoords.lat.toFixed(6)}, {submittingCoords.lng.toFixed(6)}" 
            />
          </div>

          <div class="form-group">
            <label for="cameraType">Camera Hardware Type</label>
            <select id="cameraType" bind:value={cameraType}>
              <option value="alpr">ALPR (License Plate Reader)</option>
              <option value="traffic">Traffic Speed Dome</option>
              <option value="fixed">Fixed Security Camera</option>
              <option value="mobile">Mobile Radar Unit</option>
              <option value="unknown">Unknown Camera</option>
            </select>
          </div>

          <div class="form-group">
            <label for="description">Location Landmarks (Optional)</label>
            <input 
              id="description"
              type="text" 
              bind:value={description} 
              placeholder="e.g., Near exit ramp light pole" 
            />
          </div>

          <div class="form-group">
            <label for="notes">Submitter Description Notes (Optional)</label>
            <textarea 
              id="notes"
              bind:value={submitterNotes} 
              placeholder="Provide context or directions..."
            ></textarea>
          </div>

          {#if errorMessage}
            <div class="alert alert-error">{errorMessage}</div>
          {/if}
          {#if successMessage}
            <div class="alert alert-success">{successMessage}</div>
          {/if}

          <button type="submit" class="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Publishing Pin...' : 'Publish Camera Location'}
          </button>
        </form>
      </div>

    <!-- Search/Filter panel -->
    {:else}
      <div class="section search-panel">
        <div class="search-box">
          <input 
            type="text" 
            bind:value={searchQuery} 
            placeholder="Search by city, state, or camera type..." 
          />
        </div>

        <div class="filter-row">
          <select bind:value={typeFilter}>
            <option value="">All Types</option>
            <option value="alpr">ALPR</option>
            <option value="traffic">Traffic</option>
            <option value="fixed">Fixed</option>
            <option value="mobile">Mobile</option>
          </select>

          <select bind:value={statusFilter}>
            <option value="">All Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>

        <div class="instructions-panel">
          💡 <strong>How to Contribute:</strong> Left-click anywhere on the map grid to drop a coordinates pin and report a camera location!
        </div>

        <div class="list-header">
          <h3>Camera Feed ({filteredLocations.length})</h3>
        </div>

        <div class="camera-feed-list">
          {#if filteredLocations.length === 0}
            <p class="empty-feed">No matching camera locations found inside view range.</p>
          {:else}
            {#each filteredLocations as loc}
              <button 
                class="feed-card" 
                onclick={() => selectedCameraId = loc.id}
              >
                <div class="card-header">
                  <span class="badge badge-{loc.status}">{loc.status}</span>
                  <span class="type-tag">{loc.cameraType}</span>
                </div>
                <h4 class="card-title">
                  {#if loc.city}
                    {loc.city}, {loc.state}
                  {:else}
                    Location ID: {loc.id.substring(0, 8)}...
                  {/if}
                </h4>
                <div class="card-footer">
                  <span>Confidence: {loc.confidenceScore}%</span>
                  <span>Coordinates: {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .sidebar-header {
    padding: 24px;
    border-bottom: 1px solid var(--border);
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-radar {
    font-size: 1.8rem;
  }

  .sidebar-header h1 {
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .sidebar-header h1 span {
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .sidebar-scrollable {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .back-btn {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--accent);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 0;
    transition: color var(--transition-fast);
  }

  .back-btn:hover {
    color: var(--text-primary);
  }

  .details-card {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }

  .details-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .type-tag {
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .camera-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
  }

  .stat-val {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-lbl {
    font-size: 0.7rem;
    color: var(--text-secondary);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .details-desc {
    background: rgba(255, 255, 255, 0.01);
    border-left: 3px solid var(--accent);
    padding: 12px;
    font-size: 0.9rem;
  }

  .details-desc strong {
    display: block;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .details-desc p {
    color: var(--text-primary);
    line-height: 1.5;
  }

  .verify-controls {
    border-top: 1px solid var(--border);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .verify-controls h3 {
    font-size: 1rem;
    font-weight: 600;
  }

  .verify-helper {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .vote-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .vote-btn {
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.85rem;
  }

  .vote-btn.upvote {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success);
    border-color: rgba(16, 185, 129, 0.3);
  }
  .vote-btn.upvote:hover {
    background: var(--success);
    color: white;
  }

  .vote-btn.downvote {
    background: rgba(239, 68, 68, 0.1);
    color: var(--error);
    border-color: rgba(239, 68, 68, 0.3);
  }
  .vote-btn.downvote:hover {
    background: var(--error);
    color: white;
  }

  .flag-btn {
    padding: 10px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: var(--error);
    font-weight: 500;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .flag-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Form Styling */
  .submit-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .submit-form h2 {
    font-size: 1.3rem;
  }

  .submit-helper {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-group input, .form-group select, .form-group textarea {
    background: var(--bg-input);
    border: 1px solid var(--border);
    padding: 10px;
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
    border-color: var(--accent);
  }

  .coord-preview input {
    background: rgba(255, 255, 255, 0.02);
    color: var(--accent);
    font-family: monospace;
    font-weight: 600;
  }

  .form-group textarea {
    height: 100px;
    resize: none;
  }

  .submit-btn {
    background: var(--accent-gradient);
    border: none;
    padding: 12px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-normal);
    box-shadow: 0 4px 15px var(--accent-glow);
  }
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px var(--accent-glow);
  }

  .alert {
    padding: 10px;
    border-radius: 8px;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--error);
  }

  .alert-success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: var(--success);
  }

  /* Search Panel */
  .search-box input {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border);
    padding: 12px;
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    outline: none;
    transition: border-color var(--transition-fast);
  }
  .search-box input:focus {
    border-color: var(--accent);
  }

  .filter-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .filter-row select {
    background: var(--bg-input);
    border: 1px solid var(--border);
    padding: 10px;
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.85rem;
    outline: none;
    cursor: pointer;
  }

  .instructions-panel {
    background: rgba(99, 102, 241, 0.05);
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: 8px;
    padding: 12px;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--text-secondary);
  }

  .list-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
  }

  .list-header h3 {
    font-size: 0.95rem;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .camera-feed-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
  }

  .empty-feed {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-align: center;
    padding: 24px 0;
  }

  .feed-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }
  .feed-card:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: var(--border-focus);
    transform: translateY(-1px);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
