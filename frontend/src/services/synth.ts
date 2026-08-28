/**
 * High-performance Web Audio API Polyphonic Synthesizer
 * Plays transcribed note events with realistic acoustic envelopes.
 */

class MusicSynth {
  private ctx: AudioContext | null = null;
  private activeVoices: Map<number, { oscs: OscillatorNode[]; gain: GainNode }> = new Map();

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public midiToFreq(midiNote: number): number {
    return 440.0 * Math.pow(2, (midiNote - 69) / 12);
  }

  public playNote(pitch: number, velocity: number = 80, durationSeconds?: number) {
    this.initContext();
    if (!this.ctx) return;

    const freq = this.midiToFreq(pitch);
    const now = this.ctx.currentTime;
    const velRatio = Math.max(0.1, Math.min(1.0, velocity / 127));

    // Master Note Gain Node
    const gainNode = this.ctx.createGain();
    gainNode.connect(this.ctx.destination);

    // Fundamental Oscillator (Sine / Warm Triangle)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    // Second Harmonic (Soft Brightness)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.35, now);
    osc2.connect(osc2Gain);
    osc2Gain.connect(gainNode);

    osc1.connect(gainNode);

    // ADSR Envelope (Piano Style: 8ms attack, gentle decay)
    const peakGain = 0.25 * velRatio;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, now + 0.008);

    if (durationSeconds && durationSeconds > 0) {
      const decayTarget = peakGain * 0.4;
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, decayTarget), now + Math.min(durationSeconds, 0.4));
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + durationSeconds + 0.05);
      osc2.stop(now + durationSeconds + 0.05);
    } else {
      // Sustained note until stopNote called
      gainNode.gain.exponentialRampToValueAtTime(peakGain * 0.6, now + 0.2);
      osc1.start(now);
      osc2.start(now);
      this.activeVoices.set(pitch, { oscs: [osc1, osc2], gain: gainNode });
    }
  }

  public stopNote(pitch: number) {
    if (!this.ctx) return;
    const voice = this.activeVoices.get(pitch);
    if (voice) {
      const now = this.ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      setTimeout(() => {
        voice.oscs.forEach(o => {
          try { o.stop(); } catch (e) { /* ignore */ }
        });
      }, 100);
      this.activeVoices.delete(pitch);
    }
  }

  public stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.activeVoices.forEach(voice => {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0.0001, now);
        voice.oscs.forEach(o => o.stop());
      } catch (e) { /* ignore */ }
    });
    this.activeVoices.clear();
  }

  public playMetronomeClick(accent: boolean = false) {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1600 : 900, now);

    gain.gain.setValueAtTime(accent ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const synth = new MusicSynth();
