// @ts-ignore
import Soundfont from 'soundfont-player';
import { synth } from './synth';

export type SoundfontInstrumentName =
  | 'acoustic_grand_piano'
  | 'acoustic_guitar_nylon'
  | 'violin'
  | 'flute'
  | 'electric_bass_finger';

class SoundfontService {
  private ctx: AudioContext | null = null;
  private instruments: Map<string, any> = new Map();
  private currentInstrumentName: SoundfontInstrumentName = 'acoustic_grand_piano';

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public async loadInstrument(name: SoundfontInstrumentName): Promise<any> {
    if (this.instruments.has(name)) {
      return this.instruments.get(name);
    }

    try {
      const ctx = this.getAudioContext();
      const inst = await Soundfont.instrument(ctx, name, {
        soundfont: 'MusyngKite',
        gain: 1.5,
      });
      this.instruments.set(name, inst);
      this.currentInstrumentName = name;
      return inst;
    } catch (err) {
      console.warn(`Soundfont load failed for ${name}, falling back to Web Audio Synth`, err);
      return null;
    }
  }

  public setInstrument(name: SoundfontInstrumentName) {
    this.currentInstrumentName = name;
    this.loadInstrument(name).catch(() => {});
  }

  public getInstrumentName(): SoundfontInstrumentName {
    return this.currentInstrumentName;
  }

  public playNote(
    pitch: number,
    duration: number = 0.5,
    velocity: number = 80,
    startTime?: number
  ) {
    const inst = this.instruments.get(this.currentInstrumentName);
    const ctx = this.getAudioContext();

    if (inst) {
      try {
        const gain = Math.max(0.1, Math.min(1.0, velocity / 127.0));
        inst.play(pitch, startTime !== undefined ? startTime : ctx.currentTime, {
          duration: Math.max(0.1, duration),
          gain: gain * 1.5,
        });
        return;
      } catch (e) {
        // fallback
      }
    }

    // Fallback to Web Audio polyphonic synthesizer
    synth.playNote(pitch, velocity, duration);
  }

  public stop() {
    const inst = this.instruments.get(this.currentInstrumentName);
    if (inst && typeof inst.stop === 'function') {
      try {
        inst.stop();
      } catch (e) {}
    }
    synth.stopAll();
  }
}

export const soundfontService = new SoundfontService();
