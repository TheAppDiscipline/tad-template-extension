import { useEffect, useState } from 'react'
import { getStorage, setStorage } from '../../src/lib/storage'

export default function OptionsApp() {
  const [apiBase, setApiBase] = useState<string>('')

  useEffect(() => {
    getStorage<string>('apiBase').then((value) => {
      if (typeof value === 'string') setApiBase(value)
    })
  }, [])

  async function save() {
    await setStorage('apiBase', apiBase)
  }

  return (
    <main
      style={{
        padding: 'var(--space-6)',
        maxWidth: '720px',
        margin: '0 auto',
      }}
    >
      <h1>Options</h1>
      <p style={{ color: 'var(--color-fg-muted)' }}>
        Configuración persistida en <code>browser.storage.sync</code>.
      </p>

      <section style={{ marginTop: 'var(--space-5)' }}>
        <label
          htmlFor="apiBase"
          style={{ display: 'block', marginBottom: 'var(--space-2)' }}
        >
          Sidecar API base URL
        </label>
        <input
          id="apiBase"
          type="url"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          placeholder="https://your-sidecar.example.com"
          style={{
            width: '100%',
            padding: 'var(--space-2)',
            fontSize: 'var(--text-base)',
          }}
        />
        <button
          type="button"
          onClick={save}
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-4)',
          }}
        >
          Save
        </button>
      </section>
    </main>
  )
}
