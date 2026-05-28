let recordedBuffer: AudioBuffer | null = null;
let audioContext: AudioContext | null = null;
let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;

export function registerActiveRecording(
  recorder: MediaRecorder,
  stream: MediaStream,
): void {
  activeRecorder = recorder;
  activeStream = stream;
}

export function clearActiveRecording(): void {
  activeRecorder = null;
  activeStream = null;
}

export function stopActiveRecording(): boolean {
  if (activeRecorder?.state === "recording") {
    activeRecorder.stop();
    return true;
  }
  return false;
}

export function abortActiveRecording(): void {
  if (activeRecorder?.state === "recording") {
    activeRecorder.stop();
  }
  activeStream?.getTracks().forEach((track) => track.stop());
  clearActiveRecording();
}

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
