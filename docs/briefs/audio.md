# Brief: Sound and Music (synthesised in the browser)

Read `docs/briefs/_common.md` first.

All sound is generated with the Web Audio API at run time; there are no audio files. Nobody will be able to listen to your work
before the user does, so you must reason carefully about what each recipe sounds like and verify what can be verified by measurement.
The goal is the audio equivalent of the visual brief: pleasant, soft, a little charming, never harsh, never fatiguing over a
45-minute session. When unsure, make it quieter, shorter, rounder.

## Your files

- `src/audio/audio.js` exporting `createAudio()` which returns an object satisfying `AudioEngine` from `src/types/app.d.ts`.
  Further modules under `src/audio/` as you see fit (`synth.js`, `sfx.js`, `music.js` ...).
- `dev/audio.html` a sound board (a button per sound and per age's music) plus the offline self-test described below.

## What to build

**Engine**: one `AudioContext`, created lazily in `unlock()` (browsers require a user gesture; calls before that are silently
ignored). Signal chain: voices -> sfx bus / music bus -> master gain -> a gentle compressor/limiter -> destination.
`applySettings` maps `masterVolume`, `sfxVolume`, `musicVolume`, `muted` with short ramps (no clicks). `setPaused(true)` fades music
down to a murmur and mutes game sfx; UI sounds still play. All timing through `audioContext.currentTime`, never `setTimeout` for notes
(a look-ahead scheduler driven by a timer is fine for music).

**Shot and impact sounds**: every id of `ShotSound` and `ImpactSound` in `src/types/content.d.ts` gets a recipe (noise bursts through
filters, pitch sweeps, simple FM, short envelopes). Each tower names its sounds in its data (`tier.shot.sound`, `tier.shot.impactSound`).
Guidelines: 40 to 250 ms; attack soft enough to avoid clicks (at least 2 ms); pitch randomised by a few percent per play; level
balanced so that a machine gun firing ten times a second is a soft purr below the music's presence, while a cannon is a round thump.
Old ages sound woody, stony, stringy; later ages metallic; the future glassy and electric. Nothing may sound like a real gunshot crack.

**Game events** (`handleEvents`): `shot` -> the tower's shot sound; `hit` -> its impact sound (louder with `splash`); `kill` -> a soft
"plopp" whose pitch climbs a pentatonic scale when kills follow each other within a second (resets after a pause), bosses get a
timpani-like thud and a short flourish; `leak` -> a low, round two-note fall (never an alarm); `gold` with reasons `wave`/`early`/`age`
-> a small coin shimmer; `waveStart` -> a call in the timbre of the age (horn, bell, drum, siren-free), `boss` waves add a low
warning swell; `waveClear` -> a short resolved chord, brighter when `perfect`; `age` -> see music; `build`/`upgrade`/`modernize`/`sell`
-> the matching `UiSound`; `ability` -> its `def.sound` impact, big; `won`/`lost` -> fanfare / gentle descending phrase.
Positions do not matter (no panning needed), but **voice management does**: at most about 16 simultaneous sfx voices; per sound id a
minimum interval (for example 45 ms) and at most 3 overlapping instances; when the budget is exceeded the quietest/oldest request is
dropped. `setSpeed(4)` raises the minimum intervals so 4x speed does not become noise. Many identical events in one `handleEvents`
call collapse into one slightly louder sound.

**UI sounds** (`ui(sound)`): every `UiSound`. Tiny, soft, wooden or glassy blips. `error` is a gentle double "tock", not a buzzer.
`hover` is nearly inaudible. `ageUp` is the big moment: a rising shimmer that lands on the new age's first chord.

**Music** (`setAge(ageId | null)`): generative, from `MusicTheme` in the content (`content.ages[i].music`; import `content` from
`src/content/index.js`; if it does not exist yet when you start, build against the type and a stand-in list, and switch when it appears).
- One short leitmotif (8 to 12 notes, written as scale degrees) runs through the whole game; every age plays it in its own scale,
  tempo and timbre and varies it (transposition, rhythm, call and response), with long rests. It should feel like the same tune
  travelling through time. `docs/DESIGN.md` describes the mood of every age.
- Layers: a soft sustained backing (drone or slow chords from the scale), the lead playing motif variations sparsely, optional gentle
  percussion per `percussion`. `energy` controls density. During a running wave the music may be a little more present than in the
  build phase (you get `waveStart`/`waveClear`/`won`/`lost` events through `handleEvents`).
- Timbres are simple but pleasant: for example flute = sine plus a little breath noise with slow vibrato; pluck = Karplus-Strong or a
  fast-decaying triangle through a lowpass; strings/pad = detuned saws through a lowpass with slow attack; bell = FM with long decay;
  organ = additive; brass = saw with a filter envelope; synth = soft square with chorus. A small feedback-delay or convolution-free
  reverb (a few comb/allpass delays) on the music bus adds air; keep it light.
- `setAge` cross-fades over about 3 seconds; `null` = calm menu music (the motif very slowly on a pad).
- Music must never dominate: its bus peaks well below the sfx bus maximum; default volumes in the settings are moderate.

## Verification (mandatory)

In `dev/audio.html` implement a self-test that renders every shot, impact and UI sound and 20 seconds of every age's music through
an `OfflineAudioContext` using the SAME recipe code as the live engine (so structure your synth functions to take any
`BaseAudioContext` and a destination node), and reports per item: duration, peak, RMS, DC offset, share of silent samples, and
whether any sample is NaN or beyond +-1. Run it with
`node tools/shot.mjs "http://127.0.0.1:8317/dev/audio.html?selftest=1" <png> --ready --eval "return window.__audioReport"`.
Targets: no NaN, no clipping, no DC offset above 0.01; one-shot sfx peak between about 0.05 and 0.5 and decaying to silence at the
end (no cut-off tails, no clicks: first and last samples near zero); loudness (RMS) of similar sounds within a factor of about 3 of
each other; music RMS below the typical sfx RMS. Also render "ten machine-gun shots per second for two seconds" and "30 kills in one
second" through the voice manager and confirm the peak stays below 0.9. Include the measured table in your report.

## Acceptance

- `AudioEngine` fully implemented; unknown sound ids are ignored with one console warning each, never an exception.
- No audio node leaks: every voice stops and disconnects itself; a ten-minute simulated session keeps the number of live nodes bounded
  (count them in a debug counter and report it).
- `npx tsc -p jsconfig.json` clean for your files.
