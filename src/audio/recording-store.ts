let recordedBuffer: AudioBuffer | null = null;
let audioContext: AudioContext | null = null;

export function setRecordedAudio(
  ctx: AudioContext,
  buffer: AudioBuffer,
): void {
  audioContext = ctx;
  recordedBuffer = buffer;
}

export function getRecordedAudio(): {
  ctx: AudioContext;
  buffer: AudioBuffer;
} | null {
  if (!audioContext || !recordedBuffer) return null;
  return { ctx: audioContext, buffer: recordedBuffer };
}

export function clearRecordedAudio(): void {
  recordedBuffer = null;
  audioContext = null;
}
