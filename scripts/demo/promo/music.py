"""Original music bed + UI sound effects for the EpisodeKit promo (no samples, no external services).

120 BPM, C major, 42 s. Bars are 2 s and line up with the scene cuts in promo.html:
  0-4  intro (pads + filtered pluck, riser into 4 s)
  4-16 groove (kick, bass, pluck; hats from 8 s)
  16-26 full (claps, brighter pluck)
  26-36 lift (open hats, octave pluck)
  36-42 outro (drums out, resolve on C at 40 s)
Usage: python3 scripts/demo/promo/music.py out/promo/music.wav [click_times_csv]
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 48000
BPM = 120
BEAT = 60 / BPM
DUR = 42.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, d, s, r, hold):
    """ADSR envelope, all times in seconds; hold = time before release."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), 1.0)
    dec = (t >= a) & (t < a + d)
    e = np.where(dec, 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    e = np.where((t >= a + d) & (t < hold), s, e)
    e = np.where(t >= hold, s * np.exp(-(t - hold) / max(r, 1e-4)), e)
    return e


def lp(x, hz, order=2):
    return sosfilt(butter(order, min(hz, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    gl = gain * np.sqrt(0.5 * (1 - pan))
    gr = gain * np.sqrt(0.5 * (1 + pan))
    L[i : i + len(sig)] += sig * gl
    R[i : i + len(sig)] += sig * gr


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for dv in (-detune, 0.0, detune):
        ph = (f * (1 + dv) * t) % 1.0
        out += 2 * ph - 1
    return out / 3


# --- harmony: C | Am | F | G, one chord per bar ---
CHORDS = [
    [60, 64, 67, 72],  # C
    [57, 60, 64, 69],  # Am
    [53, 57, 60, 65],  # F
    [55, 59, 62, 67],  # G
]
ROOTS = [36, 33, 29, 31]
BARS = int(DUR // 2)


def chord_at(bar):
    return CHORDS[bar % 4], ROOTS[bar % 4]


# pads: soft detuned saws, low-passed, whole bar
for bar in range(BARS):
    notes, _ = chord_at(bar)
    if bar >= 20:
        notes = CHORDS[0]
    t0 = bar * 2
    length = 2.4 if bar < 20 else 2.0
    n = int(length * SR)
    pad = sum(saw(midi(m), n, 0.004) for m in notes[:3])
    cutoff = 900 if t0 < 4 else (1600 if t0 < 26 else 2200)
    pad = lp(pad, cutoff) * env(n, 0.35, 0.3, 0.8, 0.6, length - 0.5)
    add(pad, t0, 0.10, -0.2)
    add(pad, t0 + 0.012, 0.10, 0.2)

# final resolving chord at 40 s with a long tail
n = int(2.0 * SR)
fin = sum(saw(midi(m), n, 0.004) for m in [48, 60, 64, 67, 72])
fin = lp(fin, 1800) * env(n, 0.02, 0.4, 0.6, 0.7, 0.6)
add(fin, 40.0, 0.16)

# pluck arpeggio: 16ths, pattern over chord tones
PATTERN = [0, 2, 1, 3, 2, 1, 0, 2]
for step in range(int(40 / (BEAT / 2))):
    t0 = step * BEAT / 2
    bar = int(t0 // 2)
    notes, _ = chord_at(bar)
    m = notes[PATTERN[step % 8]] + (12 if t0 >= 26 and step % 4 == 3 else 0)
    n = int(0.35 * SR)
    f = midi(m + 12)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * saw(f, n)
    cutoff = 1400 if t0 < 4 else (3200 if t0 < 16 else 4800)
    tone = lp(tone, cutoff) * np.exp(-t * 11)
    vel = 0.9 if step % 4 == 0 else 0.62
    pan = 0.35 if step % 2 else -0.35
    gain = 0.05 if t0 < 4 else 0.075
    add(tone, t0, gain * vel, pan)
    add(lp(tone, 2500), t0 + BEAT * 0.75, gain * vel * 0.28, -pan)  # dotted-8th echo

# bass: 8ths on the root, from 4 s to 36 s
for step in range(int(4 / (BEAT / 2) * 0), int(36 / (BEAT / 2))):
    t0 = step * BEAT / 2
    if t0 < 4:
        continue
    _, root = chord_at(int(t0 // 2))
    n = int(0.26 * SR)
    t = np.arange(n) / SR
    f = midi(root + 12)
    b = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    b = lp(b, 600) * env(n, 0.005, 0.08, 0.6, 0.05, 0.2)
    add(b, t0, 0.20 if step % 2 == 0 else 0.15)


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    k = np.sin(ph) * np.exp(-t * 7.5)
    k += 0.25 * lp(rng.standard_normal(n), 3000) * np.exp(-t * 120)
    return k


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    h = hp(rng.standard_normal(n), 7500)
    return h * np.exp(-t * (14 if open_ else 70))


def clap():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    noise = sosfilt(butter(2, [900, 4200], "band", fs=SR, output="sos"), rng.standard_normal(n))
    e = np.exp(-t * 22)
    for off in (0.0, 0.011, 0.022):
        e = e + 0.6 * np.exp(-np.clip(t - off, 0, None) * 160) * (t >= off)
    return noise * e


K, HC, HO, CL = kick(), hat(), hat(True), clap()
for beat in range(int(DUR / BEAT)):
    t0 = beat * BEAT
    if 4 <= t0 < 36:
        add(K, t0, 0.55)
    if 8 <= t0 < 36:
        add(HC, t0 + BEAT / 2, 0.06, 0.3)
    if 26 <= t0 < 36:
        add(HO, t0 + BEAT / 2, 0.035, -0.3)
    if 16 <= t0 < 36 and beat % 2 == 1:
        add(CL, t0, 0.13, 0.05)
add(K, 40.0, 0.5)


def riser(length):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n)
    hop = 2048
    for i in range(0, n, hop):  # sweeping band-pass, rising gain
        p = i / n
        lo = 300 + 5000 * p ** 2
        seg = sosfilt(butter(2, [lo, lo * 1.8], "band", fs=SR, output="sos"), x[i : i + hop])
        out[i : i + hop] = seg
    return out * (t / length) ** 2


add(riser(2.0), 2.0, 0.14)
add(riser(2.0), 24.0, 0.10)
# soft impact on the brand reveal
n = int(1.6 * SR)
t = np.arange(n) / SR
impact = np.sin(2 * np.pi * (40 + 30 * np.exp(-t * 6)) * t) * np.exp(-t * 2.6)
add(impact, 4.0, 0.32)

# UI clicks (times from promo.html)
if len(sys.argv) > 2 and sys.argv[2]:
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    click = sosfilt(butter(2, [2000, 6000], "band", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t * 260)
    click += 0.6 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 300)
    for ts in sys.argv[2].split(","):
        add(click, float(ts), 0.12)

# simple room: two short feedback delays, then master
def room(x):
    out = x.copy()
    for d, g in ((0.031, 0.22), (0.047, 0.18), (0.071, 0.12)):
        i = int(d * SR)
        out[i:] += g * x[:-i]
    return out


mix = np.stack([room(L), room(R)], axis=1)
mix = hp(mix.T, 30).T
fade = np.ones(N)
fi = int(0.3 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fo = int(1.2 * SR)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.6) / np.tanh(1.6)  # gentle saturation / limiting
mix /= np.max(np.abs(mix)) / 0.89
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else "music.wav", SR, (mix * 32767).astype(np.int16))
print("wrote", sys.argv[1] if len(sys.argv) > 1 else "music.wav")
