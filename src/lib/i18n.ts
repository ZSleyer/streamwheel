export const messages = {
  de: {
    appTitle: 'Glücksrad',
    tagline: 'Eigenes Glücksrad mit Wahrscheinlichkeiten erstellen',
    entries: 'Einträge',
    entryLabel: 'Beschriftung',
    entryPercent: 'Wahrscheinlichkeit in % (optional)',
    auto: 'automatisch',
    addEntry: 'Eintrag hinzufügen',
    removeEntry: 'Eintrag entfernen:',
    spin: 'Drehen',
    spinning: 'Das Rad dreht sich …',
    winner: 'Gewinner',
    share: 'Link teilen',
    copied: 'Link kopiert!',
    warnOver100: 'Die festen Prozente ergeben mehr als 100 % — sie werden anteilig umgerechnet.',
    needTwo: 'Mindestens zwei Einträge nötig, um zu drehen.',
    maxReached: 'Maximal 24 Einträge.',
    wheelAlt: 'Glücksrad mit den Einträgen:',
    switchLang: 'Switch to English',
  },
  en: {
    appTitle: 'Wheel of Fortune',
    tagline: 'Create your own wheel with custom probabilities',
    entries: 'Entries',
    entryLabel: 'Label',
    entryPercent: 'Probability in % (optional)',
    auto: 'automatic',
    addEntry: 'Add entry',
    removeEntry: 'Remove entry:',
    spin: 'Spin',
    spinning: 'The wheel is spinning …',
    winner: 'Winner',
    share: 'Share link',
    copied: 'Link copied!',
    warnOver100: 'Fixed percentages add up to more than 100% — they will be scaled proportionally.',
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
    // localStorage blockiert — Browsersprache nutzen.
  }
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function persistLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // egal, nur Komfort
  }
  document.documentElement.lang = lang
}
