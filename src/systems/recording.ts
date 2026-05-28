import { createSystem, Entity, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import {
  abortActiveRecording,
  clearActiveRecording,
  getRecordedAudio,
  registerActiveRecording,
  setRecordedAudio,
} from "../audio/recording-store.js";

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
}) {
  init() {
    this.triggerEarlyPermissionPrompt();

    this.cleanupFuncs.push(
      this.queries.activeRecordingTask.subscribe("qualify", (taskEntity) => {
        this.startRecording(taskEntity);
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        abortActiveRecording();
      }),

      this.queries.activePlaybackTask.subscribe("qualify", (taskEntity) => {
        this.startPlayback(taskEntity);
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
      const audioContext = new AudioContext();

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      registerActiveRecording(recorder, stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        clearActiveRecording();
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunks, { type: recorder.mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        setRecordedAudio(audioContext, buffer);

        if (taskEntity.active && !taskEntity.hasComponent(CompletedTask)) {
          taskEntity.addComponent(CompletedTask);
        }
      };

      recorder.start();
    } catch (err) {
      console.error("Recording failed:", err);
      clearActiveRecording();
    }
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
}
