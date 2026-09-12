import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import postcss from 'postcss'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tad-postcss-map-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const project = path.join(root, 'project')
  fs.mkdirSync(project)
  return { root, project, from: path.join(project, 'input.css'), to: path.join(project, 'output.css') }
}

function writeMap(file, source, content) {
  fs.writeFileSync(file, JSON.stringify({
    version: 3, file: 'input.css', sources: [source], sourcesContent: [content],
    names: [], mappings: 'AAAA',
  }))
}

function annotatedCss(url) {
  // Construct only a temporary fixture, never a packaged source-map reference.
  return 'a{color:red}\n/*# sourceMappingURL' + '=' + url + ' */'
}

function assertOutsideMapBlocked(result) {
  const output = result.css + (result.map?.toString() ?? '')
  assert.equal(output.includes('TAD_SYNTHETIC_OUTSIDE_CONTENT'), false, 'external source contents leaked')
  assert.equal(output.includes('synthetic-outside-source.scss'), false, 'external source path leaked')
  assert.equal(result.root.first.source.input.map?.text, undefined, 'external map was loaded')
}

test('PostCSS blocks a map traversal outside the CSS directory', async (t) => {
  const { root, from, to } = fixture(t)
  writeMap(path.join(root, 'outside.map'), 'synthetic-outside-source.scss', 'TAD_SYNTHETIC_OUTSIDE_CONTENT')
  const result = await postcss([]).process(annotatedCss('../outside.map'), { from, to, map: { inline: false } })
  assertOutsideMapBlocked(result)
})

test('PostCSS blocks an absolute external map when from is omitted', async (t) => {
  const { root } = fixture(t)
  const outside = path.join(root, 'outside.map')
  writeMap(outside, 'synthetic-outside-source.scss', 'TAD_SYNTHETIC_OUTSIDE_CONTENT')
  const result = await postcss([]).process(annotatedCss(outside.replaceAll('\\', '/')), { map: { inline: false } })
  assertOutsideMapBlocked(result)
})

test('PostCSS preserves a legitimate map beside the CSS input', async (t) => {
  const { project, from, to } = fixture(t)
  writeMap(path.join(project, 'input.css.map'), 'synthetic-local-source.scss', 'TAD_SYNTHETIC_LOCAL_CONTENT')
  const result = await postcss([]).process(annotatedCss('input.css.map'), { from, to, map: { inline: false } })
  assert.ok(result.map, 'legitimate map must be generated')
  const output = result.map.toJSON()
  assert.ok(output.sources.includes('synthetic-local-source.scss'))
  assert.ok(output.sourcesContent.includes('TAD_SYNTHETIC_LOCAL_CONTENT'))
})
