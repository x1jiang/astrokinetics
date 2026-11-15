"""
Original orchestral-style score for the 30-second demo (synthesised, no samples, no quotations).

A space-adventure cue in D minor that resolves to D major on the end card: plucked ostinato and
bass, a string pad, a horn-like melody, low drums. Written for this film; it does not reproduce any
existing theme. Output: assets/audio_final/score.wav (48 kHz stereo).

  uv run --no-project --python 3.12 --with numpy python build_score.py [seconds] [end_card_start]
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
TOTAL = float(sys.argv[1]) if len(sys.argv) > 1 else 29.23
END_AT = float(sys.argv[2]) if len(sys.argv) > 2 else 23.8   # the end card lands on bar 12
BAR = END_AT / 11.0                                             # eleven bars lead up to it
BEAT = BAR / 4.0
N = int((TOTAL + 2.5) * SR)
rng = np.random.default_rng(7)

NOTE = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "Bb": 10, "B": 11}


def hz(name: str) -> float:
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[pitch] + 12 * (octave + 1) - 69) / 12)


def tone(freq, dur, harmonics, attack, release, decay=0.0, vibrato=0.0, detune=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for cents in ([0.0] if not detune else [-detune, 0.0, detune]):
        f = freq * 2 ** (cents / 1200)
        phase = 2 * np.pi * f * t
        if vibrato:
            phase += vibrato * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.35)
        for k, amp in enumerate(harmonics, start=1):
            if f * k > 9000:
                break
            # higher partials die away faster, like a plucked or blown tone losing its edge
            out += amp * np.sin(k * phase) * (np.exp(-decay * k * t) if decay else 1.0)
    env = np.minimum(1, t / max(attack, 1e-4)) * np.minimum(1, (dur - t) / max(release, 1e-4))
    return out * np.clip(env, 0, 1) / (3 if detune else 1)


def place(track, sound, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sound = sound[: N - i]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    track[0, i:i + len(sound)] += sound * gain * left
    track[1, i:i + len(sound)] += sound * gain * right


PLUCK = [1, 0.6, 0.42, 0.3, 0.2, 0.14, 0.1]
BASS = [1, 0.55, 0.3, 0.16, 0.08]
STRINGS = [1, 0.5, 0.33, 0.22, 0.14, 0.09]
HORN = [1, 0.72, 0.55, 0.36, 0.24, 0.15, 0.09, 0.05]

# bar -> (root, third, fifth) in the plucked register, and the bass note
CHORDS = {
    "Dm": (("D3", "F3", "A3"), "D2"), "Bb": (("Bb2", "D3", "F3"), "Bb1"), "C": (("C3", "E3", "G3"), "C2"),
    "F": (("F3", "A3", "C4"), "F2"), "Gm": (("G3", "Bb3", "D4"), "G2"), "A": (("A2", "C#3", "E3"), "A1"),
    "D": (("D3", "F#3", "A3"), "D2"), "G/D": (("D3", "G3", "B3"), "D2"),
}
PROGRESSION = ["Dm", "Dm", "Bb", "C", "Dm", "F", "Bb", "C", "Gm", "Bb", "A", "D", "G/D", "D", "D"]

# melody: (bar, beat, beats long, note). An original line: steps and thirds, no leaping fanfare figure.
MELODY = [
    (4, 0, 2, "D5"), (4, 2, 1, "F5"), (4, 3, 1, "E5"),
    (5, 0, 3, "C5"), (5, 3, 1, "A4"),
    (6, 0, 2, "Bb4"), (6, 2, 1, "D5"), (6, 3, 1, "F5"),
    (7, 0, 3, "E5"), (7, 3, 1, "G5"),
    (8, 0, 2, "G5"), (8, 2, 2, "Bb5"),
    (9, 0, 2, "A5"), (9, 2, 2, "F5"),
    (10, 0, 1, "E5"), (10, 1, 1, "F5"), (10, 2, 1, "G5"), (10, 3, 1, "A5"),
    (11, 0, 4, "F#5"), (12, 0, 2, "G5"), (12, 2, 2, "B5"), (13, 0, 6, "A5"),
]
HARMONY = [(11, 0, 4, "D5"), (11, 0, 4, "A4"), (12, 0, 4, "D5"), (13, 0, 6, "F#5"), (13, 0, 6, "D5")]

dry = np.zeros((2, N))   # close, rhythmic parts
wet = np.zeros((2, N))   # parts that go through the hall

for bar, name in enumerate(PROGRESSION):
    t0 = bar * BAR
    if t0 > TOTAL + 1:
        break
    (root, third, fifth), bass = CHORDS[name]
    final = bar >= 11
    level = 0.55 + 0.45 * min(1, bar / 8)            # the cue grows toward the end card

    # bass: half notes
    for half in range(2):
        place(dry, tone(hz(bass), BEAT * 2.02, BASS, 0.012, 0.12, decay=1.4), t0 + half * 2 * BEAT, 0.5 * level)
        place(dry, tone(hz(bass) / 2, BEAT * 2.02, [1], 0.02, 0.15), t0 + half * 2 * BEAT, 0.3 * level)

    # plucked ostinato in eighths
    up = lambda n, o=1: n[:-1] + str(int(n[-1]) + o)
    pattern = [root, fifth, up(root), fifth, up(third), fifth, up(root), fifth]
    for step, note in enumerate(pattern):
        accent = 1.0 if step % 4 == 0 else 0.72
        place(dry, tone(hz(up(note)), BEAT * 0.5, PLUCK, 0.004, 0.06, decay=3.2), t0 + step * BEAT / 2,
              0.2 * level * accent, pan=-0.35 if step % 2 else 0.35)

    # strings: the triad held through the bar, entering in bar 2
    if bar >= 2:
        for i, note in enumerate((root, third, fifth)):
            place(wet, tone(hz(up(note)), BAR * 1.04, STRINGS, 0.45, 0.5, vibrato=0.035, detune=7), t0,
                  (0.2 if final else 0.15) * level, pan=(-0.5, 0.0, 0.5)[i])

    # low drum on the first and third beat from bar 4, a heavier one in the finale
    if bar >= 4:
        for beat in (0, 2):
            n = int(0.42 * SR)
            t = np.arange(n) / SR
            f = 46 + 70 * np.exp(-t * 26)
            drum = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (7 if final else 10))
            place(dry, drum, t0 + beat * BEAT, (0.62 if final and beat == 0 else 0.4) * level)

# rising drum figure through bar 10, into the downbeat of the end card
for step in range(8):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = (62 + step * 7) + 40 * np.exp(-t * 30)
    place(dry, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11), 10 * BAR + step * BEAT / 2, 0.22 + 0.045 * step)

# the arrival: a deep boom under the first end-card chord
n = int(2.4 * SR)
t = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(36.7 + 30 * np.exp(-t * 9)) / SR) * np.exp(-t * 1.9)
place(dry, boom, 11 * BAR, 0.8)

for part, gain, pan in ((MELODY, 0.34, 0.12), (HARMONY, 0.2, -0.2)):
    for bar, beat, beats, note in part:
        place(wet, tone(hz(note), beats * BEAT * 0.97, HORN, 0.07, 0.16, vibrato=0.05, detune=4),
              bar * BAR + beat * BEAT, gain, pan)

# hall: convolve the melodic parts with a decaying, low-passed noise burst (heard only as reverb tail)
ir_n = int(1.9 * SR)
ir_t = np.arange(ir_n) / SR
hall = np.zeros((2, N))
for ch in range(2):
    ir = rng.standard_normal(ir_n) * np.exp(-ir_t * 3.4)
    spec = np.fft.rfft(ir)
    freqs = np.fft.rfftfreq(ir_n, 1 / SR)
    ir = np.fft.irfft(spec / (1 + (freqs / 3200.0) ** 2), ir_n)   # darker tail
    size = 1 << int(np.ceil(np.log2(N + ir_n)))
    hall[ch] = np.fft.irfft(np.fft.rfft(wet[ch], size) * np.fft.rfft(ir, size), size)[:N]
hall /= max(1e-9, np.abs(hall).max())

mix = dry + wet * 0.85 + hall * 0.5

# gentle low-pass so nothing hisses, then fades and a ceiling at -1.5 dBFS
spec = np.fft.rfft(mix, axis=1)
freqs = np.fft.rfftfreq(N, 1 / SR)
mix = np.fft.irfft(spec / (1 + (freqs / 7500.0) ** 4), N, axis=1)
t_all = np.arange(N) / SR
mix *= np.minimum(1, t_all / 0.4) * np.clip((TOTAL - t_all) / 1.4, 0, 1)
mix = np.tanh(mix / np.abs(mix).max() * 1.35)
mix = mix / np.abs(mix).max() * 0.84
mix = mix[:, : int(TOTAL * SR)]

out = Path(__file__).resolve().parent / "assets" / "audio_final" / "score.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype("<i2").tobytes())
print(f"wrote {out} ({TOTAL:.2f}s, bar {BAR:.3f}s, {240 / BAR:.1f} bpm)")
