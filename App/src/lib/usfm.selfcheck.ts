/**
 * Self-check for the USFM marker stripper. Nothing imports this, so it never ships.
 *
 *   npm run check-usfm
 */
import assert from 'node:assert/strict'
import { stripUsfm } from './usfm.ts'

// The shape that showed up in cross-refs (Luke 24:44 as stored in bible_verses).
assert.equal(
  stripUsfm('And he said unto them, \\+w These\\+w* \\+add are\\+add* \\+w the words\\+w*'),
  'And he said unto them, These are the words',
  'markers removed and the gaps they leave collapsed',
)

// Every marker shape present in the DB: \+w, \+add, \+nd, \+it, each with a closer.
assert.equal(stripUsfm('the \\+nd LORD\\+nd* said'), 'the LORD said')
assert.equal(stripUsfm('\\+it thus\\+it* saith'), 'thus saith')

// The KJV's other italic convention must survive untouched.
assert.equal(
  stripUsfm('darkness {was} upon the face'),
  'darkness {was} upon the face',
  '{italic} markings are not USFM and stay',
)

// Untouched text comes back identical (and takes the fast path).
const plain = 'In the beginning God created the heaven and the earth.'
assert.equal(stripUsfm(plain), plain)

console.log('usfm stripper: all checks passed')
