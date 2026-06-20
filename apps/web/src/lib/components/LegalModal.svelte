<script lang="ts">
  import { LEGAL_DISCLAIMER } from '@flockgps/shared';

  let { onAccept } = $props<{ onAccept: () => void }>();
  let checked = $state(false);

  function handleAccept() {
    if (checked) {
      onAccept();
    }
  }
</script>

<div class="modal-overlay">
  <div class="modal-content glass">
    <div class="modal-header">
      <span class="warning-icon">⚠️</span>
      <h2>Privacy &amp; Legal Disclaimer</h2>
    </div>
    
    <div class="modal-body">
      <p class="disclaimer-text">
        {LEGAL_DISCLAIMER}
      </p>
      
      <p class="safety-reminder">
        <strong>Important Safety Notice:</strong> Never interact with this application while operating a motor vehicle. Pull over safely or have a passenger submit camera coordinates.
      </p>
    </div>

    <div class="modal-footer">
      <label class="consent-checkbox">
        <input type="checkbox" bind:checked />
        <span class="checkbox-label">I have read, understood, and accept these legal terms and conditions.</span>
      </label>

      <button 
        class="accept-btn" 
        disabled={!checked} 
        onclick={handleAccept}
      >
        Access Platform Map
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(4, 5, 8, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .modal-content {
    max-width: 600px;
    width: 100%;
    border-radius: 16px;
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes zoomIn {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .warning-icon {
    font-size: 2.2rem;
  }

  .modal-header h2 {
    font-size: 1.6rem;
    font-weight: 700;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .disclaimer-text {
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    max-height: 200px;
    overflow-y: auto;
  }

  .safety-reminder {
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--warning);
    background: rgba(245, 158, 11, 0.06);
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid rgba(245, 158, 11, 0.15);
  }

  .modal-footer {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .consent-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
  }

  .consent-checkbox input {
    margin-top: 4px;
    accent-color: var(--accent);
    width: 18px;
    height: 18px;
  }

  .checkbox-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.4;
    user-select: none;
  }

  .accept-btn {
    width: 100%;
    padding: 14px;
    border-radius: 8px;
    border: none;
    background: var(--accent-gradient);
    color: white;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    box-shadow: 0 4px 15px var(--accent-glow);
  }

  .accept-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px var(--accent-glow);
  }

  .accept-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .accept-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
