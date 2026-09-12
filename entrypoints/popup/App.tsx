import { useEffect, useState } from 'react'
import { getStorage } from '../../src/lib/storage'

export default function App() {
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    getStorage<number>('count').then((value) => {
      if (typeof value === 'number') setCount(value)
    })
  }, [])

  return (
    <main style={{ padding: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>Discipline Loop Extension</h1>
      <p style={{ color: 'var(--color-fg-muted)', marginTop: 'var(--space-2)' }}>
        Popup placeholder. Replace with your first slice (see Step 5).
      </p>
      <p style={{ marginTop: 'var(--space-3)' }}>
        Stored count: <strong>{count}</strong>
      </p>
    </main>
  )
}
