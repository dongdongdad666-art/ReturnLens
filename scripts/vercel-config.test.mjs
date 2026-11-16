import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('configures Vite output and a single SPA fallback rewrite', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(config.framework, 'vite')
  assert.equal(config.buildCommand, 'npm run build')
  assert.equal(config.outputDirectory, 'dist')
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/index.html' }])
})

test('uses the ReturnLens browser title in the root HTML', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /<title>ReturnLens<\/title>/)
})
