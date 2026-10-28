/**
 * Self-check for the reader's text pipeline (ported from the Android app). Never shipped.
 *
 *   npm run check-text
 */
import assert from 'node:assert/strict'
import { stripUsfm } from '../data/redLetter'
import { applyOtQuoteCaps, buildFnByWord, cleanBsbText, focusSplit, parseDssMarkers, parseKJVPlus } from './verseText'
import { parsePassage } from './parsePassage'

// USFM: word markers vanish, \add becomes {italic}, \nd is the divine name in caps
assert.equal(stripUsfm('And he said unto them, \\+w These\\+w* \\+w the words\\+w*'), 'And he said unto them, These the words')
assert.equal(stripUsfm('the \\nd Lord\\nd* said'), 'the LORD said')
assert.equal(stripUsfm('darkness {was} upon'), 'darkness {was} upon', 'existing {italic} survives')
const plain = 'In the beginning God created the heaven and the earth.'
assert.equal(stripUsfm(plain), plain)

// KJV+ (English order) attaches every following tag to the preceding word
assert.deepEqual(parseKJVPlus('In G1722 the beginning G746 was G2258', true).map(t => [t.word, t.strongs]),
  [['In', ['G1722']], ['the', undefined], ['beginning', ['G746']], ['was', ['G2258']]])
// I_KJV+ (interlinear) keeps {italic} supplied words
assert.equal(parseKJVPlus('{was} H1961 good')[0].italic, true)

// KJV footnotes anchor after their anchor phrase, not the stored word_index
const fn = buildFnByWord('In the beginning God created', [{ verse: 1, marker: 'a', word_index: 99, content: 'beginning God: or, first' }])
assert.equal([...fn.keys()][0], 4)

assert.deepEqual(focusSplit('beginning'), ['beginn', 'ing'])
assert.deepEqual(focusSplit('of'), ['of', ''])

// OT quote caps mark words [start, end) of the verse
const caps = applyOtQuoteCaps([{ t: 'he said Thou shalt love', red: false }], 2, 5)
assert.equal(caps.filter(s => s.caps).map(s => s.t.trim()).join(' '), 'Thou shalt love')

assert.deepEqual(parseDssMarkers('אב[גד]ה').map(s => [s.t, s.lacuna]), [['אב', false], ['גד', true], ['ה', false]])
assert.equal(cleanBsbText('the . . . . . . word', false), 'the word')

// Passage parser knows apocrypha and early texts, including titles with digits
assert.deepEqual(parsePassage('Psalm 151 1')[0], { book: 'Psalm 151', chapter: 1, raw: 'Psalm 151 1', kind: 'apocrypha', verseStart: undefined, verseEnd: undefined })
assert.equal(parsePassage('Against Heresies Book 3 11:8')[0].verseStart, 8)
assert.equal(parsePassage('Didache 0')[0].chapter, 0)
assert.equal(parsePassage('jn 3:16')[0].book, 'John')

console.log('text pipeline: all checks passed')
