import { publicUrl } from "../assets/public-url.js";
import { getAudioContext, resumeAudioContext } from "./context.js";
import { NARRATION_POST_DELAY_MS } from "../systems/task-config.js";

let activeSource: AudioBufferSourceNode | null = null;
let activeGain: GainNode | null = null;
let playbackId = 0;
let onEndedListener: (() => void) | null = null;

const bufferCache = new Map<string, AudioBuffer>();

/** Playback rate for all narrated voice lines. */
export const NARRATION_PLAYBACK_RATE = 1;

async function loadBuffer(url: string): Promise<AudioBuffer> {
  const resolved = publicUrl(url);
  const cached = bufferCache.get(resolved);
  if (cached) return cached;

  const response = await fetch(resolved);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} loading ${resolved}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const ctx = getAudioContext();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  bufferCache.set(resolved, buffer);
  return buffer;
}

export function playInfoDetailNarration(
  url: string | undefined,
  onEnded: () => void,
): () => void {
  let cancelled = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    onEnded();
  };

  const scheduleClose = () => {
    timeout = setTimeout(finish, NARRATION_POST_DELAY_MS);
  };

  if (!url) {
    scheduleClose();
  } else {
    // playTaskNarration fetches + caches internally and calls scheduleClose when done
    // (or on error), so no separate pre-fetch is needed.
    playTaskNarration(url, 1, scheduleClose);
  }

  return () => {
    cancelled = true;
    if (timeout) clearTimeout(timeout);
    stopTaskNarration();
  };
}

export function playTaskNarration(
  url: string,
  volume = 1,
  onEnded?: () => void,
): void {
  stopTaskNarration();
  onEndedListener = onEnded ?? null;
  const id = ++playbackId;

  void (async () => {
    try {
      const ctx = await resumeAudioContext();
      const buffer = await loadBuffer(url);
      if (id !== playbackId) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = NARRATION_PLAYBACK_RATE;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      source.onended = () => {
        if (activeSource === source) {
          activeSource = null;
          activeGain = null;
        }
        if (id === playbackId) {
          const listener = onEndedListener;
          onEndedListener = null;
          listener?.();
        }
      };

      activeSource = source;
      activeGain = gain;
      source.start(0);
    } catch (error) {
      console.warn(`[narration] Failed to play ${url}:`, error);
      if (id === playbackId) {
        const listener = onEndedListener;
        onEndedListener = null;
        activeSource = null;
        activeGain = null;
        listener?.();
      }
    }
  })();
}

export function stopTaskNarration(): void {
  playbackId++;
  onEndedListener = null;

  if (!activeSource) return;

  activeSource.onended = null;
  try {
    activeSource.stop();
  } catch {
    // Already stopped.
  }

  activeSource.disconnect();
  activeGain?.disconnect();
  activeSource = null;
  activeGain = null;
}
