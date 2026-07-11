export type ObsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// Obfuscation only, not encryption: anyone with the link and this source can
// decode it. It merely keeps the password out of plain sight in the URL bar.
const XOR_KEY = new TextEncoder().encode('rad-obs-bookmark-k1')

const xor = (data: Uint8Array) => data.map((b, i) => b ^ XOR_KEY[i % XOR_KEY.length])

/** Pack OBS port + password into an obfuscated base64url blob for bookmark links. */
export function packObsCreds(port: string, password: string): string {
  const bytes = xor(new TextEncoder().encode(JSON.stringify({ p: port, w: password })))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** Reverse of packObsCreds; null on any malformed input. */
export function unpackObsCreds(blob: string): { port: string; password: string } | null {
  try {
    const bin = atob(blob.replaceAll('-', '+').replaceAll('_', '/'))
    const bytes = xor(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    const { p, w } = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof p !== 'string' || !/^\d{1,5}$/.test(p) || typeof w !== 'string') return null
    return { port: p, password: w }
  } catch {
    return null
  }
}

export type ObsConnection = {
  emit: (eventName: string, eventData: Record<string, unknown>) => void
  close: () => void
}

const b64 = (buf: ArrayBuffer) => {
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin)
}

const sha256b64 = async (input: string) =>
  b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)))

/** obs-websocket v5 auth string: base64(sha256(base64(sha256(pw+salt)) + challenge)). */
const obsAuth = async (password: string, salt: string, challenge: string) =>
  sha256b64((await sha256b64(password + salt)) + challenge)

/**
 * Connect to the local obs-websocket server (OBS: Tools -> WebSocket Server Settings)
 * and expose emit(), which forwards events to all OBS browser sources via the
 * obs-browser vendor request. Browser sources receive them as window CustomEvents.
 */
export function connectObs(
  port: string,
  password: string,
  onStatus: (s: ObsStatus) => void,
): ObsConnection {
  const ws = new WebSocket(`ws://127.0.0.1:${encodeURIComponent(port)}`)
  onStatus('connecting')
  let failed = false
  ws.onmessage = async (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      if (msg.op === 0) {
        const auth = msg.d?.authentication
        const authentication = auth ? await obsAuth(password, auth.salt, auth.challenge) : undefined
        ws.send(
          JSON.stringify({
            op: 1,
            d: { rpcVersion: 1, ...(authentication ? { authentication } : {}) },
          }),
        )
      } else if (msg.op === 2) {
        onStatus('connected')
      }
    } catch {
      failed = true
      onStatus('error')
      ws.close()
    }
  }
  ws.onerror = () => {
    failed = true
    onStatus('error')
  }
  ws.onclose = () => {
    // Auth failure closes the socket server-side; keep the error state visible.
    if (!failed) onStatus('disconnected')
  }
  return {
    emit(eventName, eventData) {
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(
        JSON.stringify({
          op: 6,
          d: {
            requestType: 'CallVendorRequest',
            requestId: crypto.randomUUID(),
            requestData: {
              vendorName: 'obs-browser',
              requestType: 'emit_event',
              requestData: { event_name: eventName, event_data: eventData },
            },
          },
        }),
      )
    },
    close() {
      ws.close()
    },
  }
}
