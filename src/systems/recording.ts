import { createComponent, createSystem, Entity, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "./task-flow.js";
import { PhonographPart } from "./phonograph.js";
import {
  Highlight,
  RECORDING_INPUT_HIGHLIGHT_COLOR,
} from "./highlight.js";

export const Recording = createComponent("Recording", {});
export const StopRecording = createComponent("StopRecording", {});
export const ClearRecording = createComponent("ClearRecording", {});

let recordedBuffer: AudioBuffer | null = null;
let audioContext: AudioContext | null = null;
let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;

function registerActiveRecording(
  recorder: MediaRecorder,
  stream: MediaStream,
): void {
  activeRecorder = recorder;
  activeStream = stream;
}

function clearActiveRecording(): void {
  activeRecorder = null;
  activeStream = null;
}

function stopRecording(): boolean {
  if (activeRecorder?.state === "recording") {
    activeRecorder.stop();
    return true;
  }
  return false;
}

function abortActiveRecording(): void {
  if (activeRecorder?.state === "recording") {
    activeRecorder.stop();
  }
  activeStream?.getTracks().forEach((track) => track.stop());
  clearActiveRecording();
}

function setRecordedAudio(
  ctx: AudioContext,
  buffer: AudioBuffer,
): void {
  audioContext = ctx;
  recordedBuffer = buffer;
}

function getRecordedAudio(): {
  ctx: AudioContext;
  buffer: AudioBuffer;
} | null {
  if (!audioContext || !recordedBuffer) return null;
  return { ctx: audioContext, buffer: recordedBuffer };
}

function clearRecordedAudio(): void {
  recordedBuffer = null;
  audioContext = null;
}

export class RecordingSystem extends createSystem({
  activeRecordingTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording")],
  },
  activePlaybackTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback")],
  },
  recordingHorn: {
    required: [PhonographPart],
    where: [eq(PhonographPart, "id", "recording_horn")],
  },
  stopRequested: { required: [StopRecording] },
  clearRequested: { required: [ClearRecording] },
}) {
  init() {
    this.triggerEarlyPermissionPrompt();

    this.cleanupFuncs.push(
      this.queries.activeRecordingTask.subscribe("qualify", (taskEntity) => {
        this.onRecordingStart();
        this.startRecording(taskEntity);
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        this.onRecordingStop();
        abortActiveRecording();
        this.world.sceneEntity.removeComponent(Recording);
      }),

      this.queries.activePlaybackTask.subscribe("qualify", (taskEntity) => {
        this.startPlayback(taskEntity);
      }),

      this.queries.stopRequested.subscribe("qualify", () => {
        stopRecording();
        this.world.sceneEntity.removeComponent(StopRecording);
      }),

      this.queries.clearRequested.subscribe("qualify", () => {
        clearRecordedAudio();
        this.world.sceneEntity
          .removeComponent(ClearRecording)
          .removeComponent(Recording)
          .removeComponent(StopRecording);
      }),
    );
  }

  private async triggerEarlyPermissionPrompt() {
    try {
      const temporaryStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      temporaryStream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Early microphone permission denied or failed:", err);
    }
  }

  private async startRecording(taskEntity: Entity) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      registerActiveRecording(recorder, stream);
      this.world.sceneEntity.addComponent(Recording);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        clearActiveRecording();
        this.world.sceneEntity.removeComponent(Recording);
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunks, { type: recorder.mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        setRecordedAudio(ctx, buffer);

        if (taskEntity.active && !taskEntity.hasComponent(CompletedTask)) {
          taskEntity.addComponent(CompletedTask);
        }
      };

      recorder.start();
    } catch (err) {
      console.error("Recording failed:", err);
      clearActiveRecording();
      this.world.sceneEntity.removeComponent(Recording);
      this.onRecordingStop();
    }
  }

  private onRecordingStart(): void {
    const recordingHorn = this.first(this.queries.recordingHorn.entities);
    if (recordingHorn && !recordingHorn.hasComponent(Highlight)) {
      recordingHorn.addComponent(Highlight, { color: RECORDING_INPUT_HIGHLIGHT_COLOR });
    }
  }

  private onRecordingStop(): void {
    const recordingHorn = this.first(this.queries.recordingHorn.entities);
    recordingHorn?.removeComponent(Highlight);
  }

  private startPlayback(taskEntity: {
    addComponent: (c: typeof CompletedTask) => void;
  }) {
    const recorded = getRecordedAudio();
    if (!recorded) {
      console.error("No recorded audio available for playback");
      taskEntity.addComponent(CompletedTask);
      return;
    }

    const source = this.playProcessedAudio(recorded.ctx, recorded.buffer);
    source.onended = () => {
      taskEntity.addComponent(CompletedTask);
    };
  }

  private playProcessedAudio(ctx: AudioContext, buffer: AudioBuffer) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const wowLFO = ctx.createOscillator();
    const wowGain = ctx.createGain();
    wowLFO.frequency.value = 4.5;
    wowGain.gain.value = 0.012;
    wowLFO.connect(wowGain);
    wowGain.connect(source.playbackRate);
    wowLFO.start();

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 550;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1900;

    const hornResonance = ctx.createBiquadFilter();
    hornResonance.type = "peaking";
    hornResonance.frequency.value = 1100;
    hornResonance.Q.value = 4.5;
    hornResonance.gain.value = 12;

    const distortion = ctx.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(45);
    distortion.oversample = "4x";

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.65;

    source
      .connect(distortion)
      .connect(highpass)
      .connect(lowpass)
      .connect(hornResonance)
      .connect(voiceGain)
      .connect(ctx.destination);

    this.playSurfaceNoise(ctx, source.buffer!.duration);

    source.start();
    return source;
  }

  private playSurfaceNoise(ctx: AudioContext, duration: number) {
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    const rpm = 130;
    const samplesPerSec = ctx.sampleRate;
    const samplesPerRevolution = Math.floor((60 / rpm) * samplesPerSec);

    for (let i = 0; i < bufferSize; i++) {
      let noise = (Math.random() * 2 - 1) * 0.2;

      const cyclePosition = i % samplesPerRevolution;

      if (cyclePosition < Math.floor(samplesPerSec * 0.015)) {
        if (Math.random() > 0.85) {
          noise += (Math.random() * 2 - 1) * 1.8;
        }
      }

      if (Math.random() > 0.9997) {
        noise += (Math.random() * 2 - 1) * 1.5;
      }

      output[i] = noise;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1000;
    noiseFilter.Q.value = 2.0;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;

    noiseSource
      .connect(noiseFilter)
      .connect(noiseGain)
      .connect(ctx.destination);
    noiseSource.start();
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === "number" ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
