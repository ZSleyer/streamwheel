export const messages = {
  de: {
    appTitle: 'Glücksrad',
    tagline: 'Das Glücksrad für deinen Stream: eigene Wahrscheinlichkeiten, Share-Link und OBS-Overlay.',
    overlay: 'OBS-Overlay',
    overlayTip:
      'Overlay-URL als Browser-Quelle in OBS einbinden (transparenter Hintergrund). Drehen: Klick oder Leertaste im Overlay (OBS: „Interagieren"), oder live von dieser Seite, wenn beide im selben Browser laufen.',
    entries: 'Einträge',
    entryLabel: 'Beschriftung',
    color: 'Farbe für',
    entryPercent: 'Wahrscheinlichkeit in % (optional)',
    auto: 'automatisch',
    addEntry: 'Eintrag hinzufügen',
    removeEntry: 'Eintrag entfernen:',
    spin: 'Drehen',
    confetti: 'Konfetti bei Gewinn',
    spinning: 'Das Rad dreht sich ...',
    winner: 'Gewinner',
    share: 'Link teilen',
    copied: 'Link kopiert!',
    warnOver100: 'Die festen Prozente ergeben mehr als 100 %, sie werden anteilig umgerechnet.',
    needTwo: 'Mindestens zwei Einträge nötig, um zu drehen.',
    maxReached: 'Maximal 24 Einträge.',
    wheelAlt: 'Glücksrad mit den Einträgen:',
    switchLang: 'Switch to English',
  },
  en: {
    appTitle: 'Wheel of Fortune',
    tagline: 'The spin wheel for your stream: custom probabilities, share links and an OBS overlay.',
    overlay: 'OBS overlay',
    overlayTip:
      'Add the overlay URL as a browser source in OBS (transparent background). Spin it by clicking or pressing space in the overlay (OBS: "Interact"), or live from this page when both run in the same browser.',
    entries: 'Entries',
    entryLabel: 'Label',
    color: 'Color for',
    entryPercent: 'Probability in % (optional)',
    auto: 'automatic',
    addEntry: 'Add entry',
    removeEntry: 'Remove entry:',
    spin: 'Spin',
    confetti: 'Confetti on win',
    spinning: 'The wheel is spinning ...',
    winner: 'Winner',
    share: 'Share link',
    copied: 'Link copied!',
    warnOver100: 'Fixed percentages add up to more than 100%, they will be scaled proportionally.',
    needTwo: 'At least two entries are needed to spin.',
    maxReached: 'Maximum of 24 entries.',
    wheelAlt: 'Wheel of fortune with the entries:',
    switchLang: 'Zu Deutsch wechseln',
  },
} as const

export type Lang = keyof typeof messages

const LANG_KEY = 'rad:lang'

export function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY)
    if (stored === 'de' || stored === 'en') return stored
  } catch {
    // localStorage blocked, fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function persistLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // best effort, persisting the language is only a convenience
  }
  document.documentElement.lang = lang
}
