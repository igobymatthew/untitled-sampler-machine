# Experimental GL/Three Animation Concepts

## Ideas for experimental pad/button/panel animations

1. **React-three-fiber pad surfaces** – Wrap each pad’s `<Card>` in `PadGrid` with a lightweight `Canvas` layer that renders a reactive plane or particle system. You can drive shader uniforms from the `selected` state (line 12) and pad color/sample metadata (lines 65-80) so idle pads shimmer gently, then burst when `onTrigger` fires (lines 15-27). Using GPU easing lets the double-click play action create volumetric ripples or audio-reactive displacement tied to gain/decay.

2. **gl-transitions for sequencer buttons** – The sequencer’s per-step `<button>` already tracks `on` toggles and the live `currentStep` cursor (lines 25-37). Hook those values into a GLSL transition (e.g., wipe, ripple, CRT bloom) so each step morphs between inactive and active states instead of snapping colors. When `isNow` flips true, run a timed shader sweep across the row to visualize the transport head, blending neighboring steps with motion blur as the pattern advances.

3. **Three-dimensional properties panel** – `PadPropertiesPanel` assembles waveform peaks, trim sliders, and pad metadata inside a glassy `<Card>` (lines 342-474). Swap the static gradient background for a `react-three-fiber` scene that extrudes the `peaks` data into a 3D waveform, lighting it with the pad color strip (lines 417-423). When users adjust trim or envelopes, animate the mesh morph in sync, and crossfade panel sections with gl-transitions so toggling loop/mute reveals futuristic HUD overlays rather than plain div swaps.
