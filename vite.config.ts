import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// CSP only for builds: the Vite/React dev server needs inline preamble scripts.
const csp = {
  name: 'inject-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    return html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'" />`,
    )
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), csp],
})
