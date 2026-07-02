// Synthesised notification chime (Web Audio API) — no audio file to bundle or
// host, works offline. A short two-note "ding-dong" similar to a messaging app.

let ctx = null

function getCtx() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  if (!ctx) ctx = new AC()
  return ctx
}

// Browsers block audio until the user interacts with the page. Resume/create the
// context on the first interaction so a timer-triggered chime can actually play.
if (typeof window !== 'undefined') {
  const unlock = () => { const c = getCtx(); if (c && c.state === 'suspended') c.resume() }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

export function playNotificationSound() {
  try {
    const c = getCtx()
    if (!c) return
    if (c.state === 'suspended') c.resume()
    const now = c.currentTime
    // Two pleasant notes: A5 then D6.
    const notes = [{ f: 880, at: 0 }, { f: 1174.66, at: 0.16 }]
    for (const { f, at } of notes) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      const t0 = now + at
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45)
      osc.connect(gain).connect(c.destination)
      osc.start(t0)
      osc.stop(t0 + 0.47)
    }
  } catch { /* ignore — sound is best-effort */ }
}
