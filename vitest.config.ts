import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const isInsideTemp = process.cwd().includes('/.temp/')

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      ...(isInsideTemp ? [] : ['**/.temp/**'])
    ]
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  }
})
