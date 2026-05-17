# Alarm Lab (xmeas_13) — Dashboard Guide

**Route:** `/alarm-xmeas13`  
**Nav label:** Alarm lab (xmeas_13)  
**Source:** `dashboard/src/components/pages/AlarmXmeas13Page.tsx`  
**Notebook:** `notebooks/alarm_management_xmeas13.ipynb`

---

## Purpose

This page is a **standalone alarm-engineering lab** for separator pressure (`xmeas_13`). It visualizes:

- **EWMA** of the raw signal
- **σ-based control band** with tail widening after fault injection
- **Deadband-latched alarms** (on/off hysteresis, rearm lockout, max latch)
- **Rate-of-change (ROC) pre-alarms** before the signal leaves the band

It mirrors the notebook animation — including optional **browser beep** while an alarm is latched.

> **Important:** This lab uses its **own** data path. Editing the main plant twin or other pages does **not** auto-sync here. Export JSON/GIF after notebook runs (see below).

---

## Page layout

```text
┌─────────────────────────────────────────────────────────────┐
│  Header + Play / Reset / Beep on|off                        │
├─────────────────────────────────────────────────────────────┤
│  Status chips: Latched alarm · ROC pre-alarm · sample %     │
│  Timeline scrubber (range input)                            │
├─────────────────────────────────────────────────────────────┤
│  EWMA + deadband animation (Recharts ComposedChart)           │
├─────────────────────────────────────────────────────────────┤
│  Notebook GIF (optional)  │  Tuning snapshot table          │
└─────────────────────────────────────────────────────────────┘
```

---

## Signal & scenario

| Item | Value |
|------|--------|
| **Measurement** | `xmeas_13` — separator pressure (kPa) |
| **Default fault context** | Fault **13** (reactor kinetics), testing split |
| **Injection sample** | `160` (`INJECT_SAMPLE_TESTING`) when using parquet/export series |
| **Demo fallback** | Synthesized drift if JSON not found (`buildDemoAlarmXmeas13Model`) |

---

## Chart layers

| Layer | Color / style | Meaning |
|-------|----------------|---------|
| Padded σ band | Sea green fill (low opacity) | Acceptable EWMA region |
| `loT` / `hiT` | Dashed green lines | σ thresholds |
| EWMA `z` | Blue line | Smoothed signal (animated) |
| Vertical “Inject” | Crimson dashed | Fault injection time |
| Cursor line | Gray | Current playback position |
| Blinking dot | Red (latched) or orange (ROC only) | Alarm state at current sample |

Playback advances **4 samples every 100 ms** when playing.

---

## Alarm logic (summary)

Implemented in `lib/alarmXmeas13Model.ts` — matches notebook tuning:

| Parameter | Default | Role |
|-----------|---------|------|
| `ALPHA_EWMA` | 0.05 | EWMA smoothing |
| `SIGMA_MULT` | 4.5 | Band width multiplier |
| `BAND_PAD_KPA` | 55 | Extra pad on limits |
| `DEADBAND_ON` | 5 | Consecutive breaches to latch ON |
| `DEADBAND_OFF` | 32 | Consecutive in-band samples to clear |
| `REARM_LOCKOUT` | 90 | Samples before re-arm after clear |
| `MAX_LATCH_SAMPLES` | 72 | Force clear after max latch duration |
| `ROC_MULT` | 3.0 | Rate-of-change pre-alarm sensitivity |
| `HYST_CLEAR_KPA` | 28.0 | Hysteresis for clear |
| `TAIL_WIDEN_SIG` | 0.35 | Post-injection band widening |

**States at current sample:**

- **Latched alarm** — `alarm[i] === 1` → red banner + optional beep loop
- **ROC pre-alarm** — high rate of change but still in-band → orange chip

---

## Controls

| Control | Action |
|---------|--------|
| **Play / Pause** | Auto-advance cursor; unlocks Web Audio on first click |
| **Reset** | Cursor to 0, stop playback |
| **Beep on/off** | Square-wave 880 Hz pulse every ~420 ms while latched + playing |
| **Scrubber** | Manual sample seek |

---

## Data publishing (team workflow)

After running the notebook cache:

```bash
python scripts/export_alarm_xmeas13_dashboard.py
```

This writes:

- `dashboard/public/data/alarm_xmeas13_series.json` — full series for the chart
- Copy GIF: `outputs/figures/alarm_xmeas13_deadband.gif` → `dashboard/public/alarm_xmeas13_deadband.gif`

When JSON loads successfully, subtitle switches from **Demo synthesis** to **Notebook parquet series**.

---

## Entry points from other UI

- **Architecture** page — click P&ID marker or “Alarm lab” button
- Sidebar — direct nav

---

## Related pages

- [architecture_dash.md](./architecture_dash.md) — P&ID context  
- [simulation_dash.md](./simulation_dash.md) — plant-wide fault injection (separate state)  
- [maintenance_dash.md](./maintenance_dash.md) — Fault 5 uses Δ XMEAS_13 in metrics

---

## Presentation walkthrough script (spoken)

*~3–4 minutes. Best after **Architecture**. Turn sound on for beep demo if the room allows.*

---

**[Enter Alarm lab — ideally from Architecture click]**

“We came from the P&ID — this is **`xmeas_13`**, separator pressure. The **Alarm lab** is separate from the main twin on purpose: alarm design is its own engineering problem, and we mirrored our notebook **`alarm_management_xmeas13`** here.

**[Point to subtitle / data source]**

If we’ve exported notebook data, the subtitle says **parquet series, Fault 13**; otherwise you’re seeing a **demo synthesis** that still follows the same logic — same tuning, same rules.

**[Chart — green band and blue line]**

The green shaded region is our **padded sigma band** around the EWMA. The dashed lines are the thresholds. The **blue line** is the EWMA — we smooth raw pressure so we don’t alarm on every spike.

The vertical red dashed line is **inject** — fault enters the data, sample **160** on the test split. After that, the band can **widen** — we call that tail widening — because we know post-fault behavior is non-stationary.

**[Click Play — talk through timeline slowly]**

I’ll hit **Play**…

Early on, the signal sits in band — nominal operation. As we approach injection, watch the gray cursor move. Sometimes you’ll see an **orange** chip: **rate-of-change pre-alarm** — the value’s still inside the band, but it’s moving fast enough that we warn early. That’s ‘heads up’ before a hard breach.

**[When latched — red banner, optional beep]**

Now we’re **latched**. Red banner, and if beep is on you’ll hear it — that’s what an operator can’t ignore. **Latch** means we don’t chatter on/off at the boundary; we need consecutive in-band samples and deadband rules before we clear.

**[Click Beep off / scrub slider]**

I can mute beep for the room, or **scrub** the timeline with this slider to replay the exact sample where we latched.

**[Tuning panel — bottom right]**

This table is the **tuning snapshot** — alpha for EWMA, sigma multiplier, deadband on and off counts, rearm lockout, max latch samples, ROC multiplier. These are the knobs you’d tune with process safety and false-alarm budget in mind. Tighter band → faster detection, more nuisance trips. Wider band → calmer console, slower detection.

**[Optional — GIF panel]**

If we dropped the notebook GIF into `public`, you can show the side-by-side: dashboard chart matches the matplotlib animation — same story for reviewers who lived in Jupyter.

**[Close]**

Takeaway: ML tells you *something changed*; alarm management tells you *when to ring the bell and when to stop*. This page is that second layer. Ready to see how incidents and work orders consume these signals?”
