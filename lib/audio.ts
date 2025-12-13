// Procedural Audio Engine for Terminal UI
// Generates synth sounds on the fly using Web Audio API

class TerminalAudio {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  public isMuted: boolean = false;

  constructor() {
    this.isMuted = localStorage.getItem('iss_terminal_muted') === 'true';
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
    }
  }

  // Explicitly resume context (must be called from user gesture)
  public async resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('iss_terminal_muted', String(this.isMuted));
    return this.isMuted;
  }

  // Subtle high-pitch chirp for hover
  public playHover() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.gainNode) return;

    // Auto-resume if needed (might fail without gesture, but worth trying)
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);

    // Increased volume: 0.02 -> 0.05
    gain.gain.setValueAtTime(0.05, t); 
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.gainNode);
    
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Mechanical click for interactions
  public playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.gainNode) return;
    
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    // Increased volume: 0.05 -> 0.15
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Data processing sound (digital flutter)
  public playDataUpdate() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.gainNode) return;
    
    // Note: This often plays automatically, so it might be blocked if context is suspended
    if (this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.linearRampToValueAtTime(1800, t + 0.05);

    // Increased volume: 0.01 -> 0.05
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Startup sound (Power up)
  public playStartup() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.gainNode) return;

    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.5);

    // Increased volume: 0.05 -> 0.2
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1);

    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.start(t);
    osc.stop(t + 1);
  }
}

export const terminalAudio = new TerminalAudio();