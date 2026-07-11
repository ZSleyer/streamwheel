export const messages = {
  de: {
    appTitle: 'Glücksrad',
    tagline: 'Das Glücksrad für deinen Stream: eigene Wahrscheinlichkeiten, Share-Link und OBS-Overlay.',
    overlay: 'OBS-Overlay',
    overlayTip:
      'Overlay-URL als Browser-Quelle in OBS einbinden (transparenter Hintergrund). Drehen direkt in OBS: Klick oder Leertaste über „Interagieren". Für Steuerung aus diesem Browser: unten mit OBS verbinden.',
    obsHeading: 'OBS-Fernsteuerung',
    obsHint:
      'In OBS: Werkzeuge → WebSocket-Server-Einstellungen → Server aktivieren. Danach hier verbinden: „Drehen" und alle Änderungen steuern dann das Overlay in OBS.',
    obsPort: 'OBS-WebSocket-Port',
    obsPassword: 'OBS-WebSocket-Passwort (falls gesetzt)',
    obsConnect: 'Mit OBS verbinden',
    obsDisconnect: 'Von OBS trennen',
    obsStatusConnecting: 'Verbinde mit OBS ...',
    obsStatusConnected: 'Mit OBS verbunden',
    obsStatusError: 'Verbindung fehlgeschlagen. Läuft OBS mit aktiviertem WebSocket-Server? Passwort korrekt?',
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
      'Add the overlay URL as a browser source in OBS (transparent background). Spin directly in OBS via "Interact" (click or space). To control it from this browser, connect to OBS below.',
    obsHeading: 'OBS remote control',
    obsHint:
      'In OBS: Tools → WebSocket Server Settings → enable the server. Then connect here: "Spin" and all changes will drive the overlay inside OBS.',
    obsPort: 'OBS WebSocket port',
    obsPassword: 'OBS WebSocket password (if set)',
    obsConnect: 'Connect to OBS',
    obsDisconnect: 'Disconnect from OBS',
    obsStatusConnecting: 'Connecting to OBS ...',
    obsStatusConnected: 'Connected to OBS',
    obsStatusError: 'Connection failed. Is OBS running with the WebSocket server enabled? Password correct?',
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
