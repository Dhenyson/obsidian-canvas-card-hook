const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeLink, parseTarget, readHook, writeHook, clipboardLink, MIME } = require('../src/core');
const context = { vault: 'Test vault', canvas: 'Folder/Canvas & ideas.canvas' };
const id = '0123456789abcdef';

test('card references round-trip Unicode, spaces and special characters', () => {
  const target = { vault: 'Brain ç & test', canvas: 'Ideas/A #1.canvas', node: id };
  assert.deepEqual(parseTarget(makeLink(target.vault, target.canvas, target.node), context), target);
  assert.deepEqual(parseTarget(id, context), { ...context, node: id });
});
test('reject unsafe paths, foreign schemes, missing fields and malformed IDs', () => {
  for (const input of ['', 'https://example.com', 'obsidian://canvas-card-hook?node=1', makeLink('Test', '../bad.canvas', id), makeLink('Test', 'ok.canvas', 'no')])
    assert.throws(() => parseTarget(input, context));
});
test('hook text survives serialization and cannot terminate its metadata comment', () => {
  const data = { title: 'Go --> <script> \"test\"\nnext', target: makeLink(context.vault, context.canvas, id) };
  const text = writeHook(data);
  assert.deepEqual(readHook(text), data);
  assert.equal(text.split('\n-->').length, 2);
  assert.ok(text.includes('Jump to card'));
  assert.equal(readHook('ordinary text'), null);
  assert.equal(readHook('<!-- canvas-card-hook:v1\ninvalid\n-->'), null);
});
test('paste prefers the source reference and never consumes or rewrites the native payload', () => {
  const native = JSON.stringify({ nodes: [{ id }], edges: [] });
  const entries = { 'obsidian/canvas': native, [MIME]: 'source-reference', 'text/plain': 'other text' };
  const data = { getData: type => entries[type] || '' };
  assert.equal(clipboardLink(data, context), 'source-reference');
  delete entries[MIME];
  assert.equal(clipboardLink(data, context), 'other text');
  delete entries['text/plain'];
  assert.equal(clipboardLink(data, context), makeLink(context.vault, context.canvas, id));
  assert.equal(entries['obsidian/canvas'], native);
  entries['obsidian/canvas'] = JSON.stringify({ nodes: [{ id }, { id: 'fedcba9876543210' }] });
  assert.equal(clipboardLink(data, context), '');
});
