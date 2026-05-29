let audioContext: AudioContext | null = null;

function ensureAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function envelopeGain(
  gain: GainNode,
  now: number,
  {
    start = 0.0001,
    peak = 0.2,
    attack = 0.001,
    decay = 0.06,
  }: {
    start?: number;
    peak?: number;
    attack?: number;
    decay?: number;
  },
) {
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(start, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(start, peak), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
}

export function playSnap(volume = 0.22): void {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.03);

  const gain = ctx.createGain();
  envelopeGain(gain, now, { peak: volume, decay: 0.035 });

  const bufferSize = Math.floor(ctx.sampleRate * 0.02);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++)
    output[i] = (Math.random() * 2 - 1) * 0.35;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 600;

  osc.connect(gain);
  gain.connect(ctx.destination);

  noise.connect(noiseFilter);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(volume * 0.55, now + 0.004);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  noise.start(now);
  osc.start(now);
  osc.stop(now + 0.05);
  noise.stop(now + 0.04);
}

export function playCrankTick(volume = 0.12): void {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.03);

  const gain = ctx.createGain();
  envelopeGain(gain, now, { peak: volume, decay: 0.04, attack: 0.002 });

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

export function playPop(volume = 0.18): void {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);

  const gain = ctx.createGain();
  envelopeGain(gain, now, { peak: volume, decay: 0.09, attack: 0.002 });

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

let recordingMotorStop: (() => void) | null = null;

export function playRecordingStart(volume = 0.24): void {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const click = ctx.createOscillator();
  click.type = "square";
  click.frequency.setValueAtTime(420, now);
  click.frequency.exponentialRampToValueAtTime(120, now + 0.04);

  const clickGain = ctx.createGain();
  envelopeGain(clickGain, now, { peak: volume, decay: 0.05, attack: 0.001 });

  const whir = ctx.createOscillator();
  whir.type = "sawtooth";
  whir.frequency.setValueAtTime(55, now + 0.02);
  whir.frequency.exponentialRampToValueAtTime(110, now + 0.22);

  const whirGain = ctx.createGain();
  whirGain.gain.setValueAtTime(0.0001, now + 0.02);
  whirGain.gain.exponentialRampToValueAtTime(volume * 0.35, now + 0.08);
  whirGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  whir.connect(whirGain);
  whirGain.connect(ctx.destination);

  click.start(now);
  click.stop(now + 0.06);
  whir.start(now + 0.02);
  whir.stop(now + 0.3);
}

export function startRecordingMotorLoop(volume = 0.045): void {
  stopRecordingMotorLoop();

  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.setValueAtTime(38, now);

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.exponentialRampToValueAtTime(volume, now + 0.35);

  const bufferSize = Math.floor(ctx.sampleRate * 2);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * 0.55;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 920;
  noiseFilter.Q.value = 1.4;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(volume * 0.75, now + 0.4);

  rumble.connect(rumbleGain);
  rumbleGain.connect(ctx.destination);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  rumble.start(now);
  noise.start(now);

  recordingMotorStop = () => {
    const stopAt = ctx.currentTime;
    rumbleGain.gain.cancelScheduledValues(stopAt);
    rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, stopAt);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, stopAt + 0.25);
    noiseGain.gain.cancelScheduledValues(stopAt);
    noiseGain.gain.setValueAtTime(noiseGain.gain.value, stopAt);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, stopAt + 0.25);
    rumble.stop(stopAt + 0.3);
    noise.stop(stopAt + 0.3);
    recordingMotorStop = null;
  };
}

export function stopRecordingMotorLoop(): void {
  recordingMotorStop?.();
}

export function playTaskChime(volume = 0.14): void {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(660, now);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(990, now);

  const gain = ctx.createGain();
  envelopeGain(gain, now, { peak: volume, decay: 0.22, attack: 0.01 });

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.35);
  osc2.stop(now + 0.35);
}
