/**
 * Fills in missing end-of-chapter commentary from catenabible.com.
 * 362 chapters were truncated early by the original fetch script due to
 * wrong verse counts or early-exit streak logic. This script fetches only
 * the missing verse ranges and appends them to commentary-catenabible.json.
 * Run: npm run fetch-gaps
 */

import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'

const API_BASE = 'https://api.catenabible.com:8080'
const OUT_PATH = path.join(__dirname, '../data/raw/commentary-catenabible.json')
const PROGRESS_PATH = path.join(__dirname, '../data/raw/fetch-gaps-progress.json')

const ERA_MAP: Record<string, { era: string; order: number }> = {
  'EF': { era: 'Early Church',   order: 4 },
  'CC': { era: 'Medieval',       order: 8 },
  'EO': { era: 'Byzantine',      order: 9 },
  'RC': { era: 'Post-Medieval',  order: 12 },
}

// All chapters with end-truncated commentary.
// fromVerse = first missing verse, toVerse = last verse in chapter (KJV).
const GAPS: Array<{ abbr: string; name: string; chapter: number; fromVerse: number; toVerse: number }> = [
  // 1 Chronicles
  { abbr: '1chr', name: '1 Chronicles', chapter: 1,  fromVerse: 26, toVerse: 54 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 2,  fromVerse: 32, toVerse: 55 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 4,  fromVerse: 41, toVerse: 43 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 6,  fromVerse: 40, toVerse: 81 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 7,  fromVerse: 6,  toVerse: 40 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 9,  fromVerse: 36, toVerse: 44 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 11, fromVerse: 39, toVerse: 47 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 13, fromVerse: 14, toVerse: 14 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 16, fromVerse: 16, toVerse: 43 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 17, fromVerse: 2,  toVerse: 27 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 19, fromVerse: 8,  toVerse: 19 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 20, fromVerse: 8,  toVerse: 8  },
  { abbr: '1chr', name: '1 Chronicles', chapter: 23, fromVerse: 16, toVerse: 32 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 24, fromVerse: 11, toVerse: 31 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 25, fromVerse: 15, toVerse: 31 },
  { abbr: '1chr', name: '1 Chronicles', chapter: 26, fromVerse: 32, toVerse: 32 },
  // 1 Kings
  { abbr: '1kgs', name: '1 Kings', chapter: 1,  fromVerse: 4,  toVerse: 53 },
  { abbr: '1kgs', name: '1 Kings', chapter: 2,  fromVerse: 40, toVerse: 46 },
  { abbr: '1kgs', name: '1 Kings', chapter: 7,  fromVerse: 41, toVerse: 51 },
  { abbr: '1kgs', name: '1 Kings', chapter: 8,  fromVerse: 16, toVerse: 66 },
  { abbr: '1kgs', name: '1 Kings', chapter: 9,  fromVerse: 28, toVerse: 28 },
  { abbr: '1kgs', name: '1 Kings', chapter: 11, fromVerse: 41, toVerse: 43 },
  { abbr: '1kgs', name: '1 Kings', chapter: 13, fromVerse: 12, toVerse: 34 },
  { abbr: '1kgs', name: '1 Kings', chapter: 15, fromVerse: 30, toVerse: 34 },
  { abbr: '1kgs', name: '1 Kings', chapter: 18, fromVerse: 41, toVerse: 46 },
  { abbr: '1kgs', name: '1 Kings', chapter: 20, fromVerse: 41, toVerse: 43 },
  { abbr: '1kgs', name: '1 Kings', chapter: 22, fromVerse: 40, toVerse: 54 },
  // 1 Peter
  { abbr: '1pt', name: '1 Peter', chapter: 1, fromVerse: 24, toVerse: 25 },
  { abbr: '1pt', name: '1 Peter', chapter: 2, fromVerse: 25, toVerse: 25 },
  { abbr: '1pt', name: '1 Peter', chapter: 4, fromVerse: 19, toVerse: 19 },
  // 1 Samuel
  { abbr: '1sm', name: '1 Samuel', chapter: 3,  fromVerse: 21, toVerse: 21 },
  { abbr: '1sm', name: '1 Samuel', chapter: 4,  fromVerse: 22, toVerse: 22 },
  { abbr: '1sm', name: '1 Samuel', chapter: 7,  fromVerse: 13, toVerse: 17 },
  { abbr: '1sm', name: '1 Samuel', chapter: 8,  fromVerse: 21, toVerse: 22 },
  { abbr: '1sm', name: '1 Samuel', chapter: 9,  fromVerse: 3,  toVerse: 27 },
  { abbr: '1sm', name: '1 Samuel', chapter: 14, fromVerse: 40, toVerse: 52 },
  { abbr: '1sm', name: '1 Samuel', chapter: 17, fromVerse: 41, toVerse: 58 },
  { abbr: '1sm', name: '1 Samuel', chapter: 20, fromVerse: 41, toVerse: 43 },
  { abbr: '1sm', name: '1 Samuel', chapter: 25, fromVerse: 40, toVerse: 44 },
  { abbr: '1sm', name: '1 Samuel', chapter: 28, fromVerse: 25, toVerse: 25 },
  { abbr: '1sm', name: '1 Samuel', chapter: 29, fromVerse: 11, toVerse: 11 },
  // 1 Thessalonians
  { abbr: '1thes', name: '1 Thessalonians', chapter: 2, fromVerse: 20, toVerse: 20 },
  // 2 Chronicles
  { abbr: '2chr', name: '2 Chronicles', chapter: 1,  fromVerse: 17, toVerse: 17 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 6,  fromVerse: 39, toVerse: 42 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 7,  fromVerse: 15, toVerse: 22 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 9,  fromVerse: 30, toVerse: 31 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 16, fromVerse: 2,  toVerse: 14 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 18, fromVerse: 4,  toVerse: 34 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 20, fromVerse: 6,  toVerse: 37 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 22, fromVerse: 12, toVerse: 12 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 28, fromVerse: 8,  toVerse: 27 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 29, fromVerse: 28, toVerse: 36 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 32, fromVerse: 27, toVerse: 33 },
  { abbr: '2chr', name: '2 Chronicles', chapter: 34, fromVerse: 26, toVerse: 33 },
  // 2 Kings
  { abbr: '2kgs', name: '2 Kings', chapter: 4,  fromVerse: 41, toVerse: 44 },
  { abbr: '2kgs', name: '2 Kings', chapter: 7,  fromVerse: 18, toVerse: 20 },
  { abbr: '2kgs', name: '2 Kings', chapter: 8,  fromVerse: 29, toVerse: 29 },
  { abbr: '2kgs', name: '2 Kings', chapter: 9,  fromVerse: 2,  toVerse: 37 },
  { abbr: '2kgs', name: '2 Kings', chapter: 10, fromVerse: 2,  toVerse: 36 },
  { abbr: '2kgs', name: '2 Kings', chapter: 11, fromVerse: 20, toVerse: 21 },
  { abbr: '2kgs', name: '2 Kings', chapter: 15, fromVerse: 38, toVerse: 38 },
  { abbr: '2kgs', name: '2 Kings', chapter: 17, fromVerse: 35, toVerse: 41 },
  { abbr: '2kgs', name: '2 Kings', chapter: 21, fromVerse: 25, toVerse: 26 },
  // 2 Peter
  { abbr: '2pt', name: '2 Peter', chapter: 3, fromVerse: 18, toVerse: 18 },
  // 2 Samuel
  { abbr: '2sm', name: '2 Samuel', chapter: 13, fromVerse: 39, toVerse: 39 },
  { abbr: '2sm', name: '2 Samuel', chapter: 15, fromVerse: 35, toVerse: 37 },
  { abbr: '2sm', name: '2 Samuel', chapter: 19, fromVerse: 41, toVerse: 43 },
  { abbr: '2sm', name: '2 Samuel', chapter: 22, fromVerse: 30, toVerse: 51 },
  // 2 Thessalonians
  { abbr: '2thes', name: '2 Thessalonians', chapter: 2, fromVerse: 17, toVerse: 17 },
  // 3 John
  { abbr: '3jn', name: '3 John', chapter: 1, fromVerse: 15, toVerse: 15 },
  // Acts
  { abbr: 'acts', name: 'Acts', chapter: 5,  fromVerse: 21, toVerse: 42 },
  { abbr: 'acts', name: 'Acts', chapter: 7,  fromVerse: 23, toVerse: 60 },
  { abbr: 'acts', name: 'Acts', chapter: 10, fromVerse: 45, toVerse: 48 },
  { abbr: 'acts', name: 'Acts', chapter: 13, fromVerse: 20, toVerse: 52 },
  { abbr: 'acts', name: 'Acts', chapter: 17, fromVerse: 30, toVerse: 34 },
  { abbr: 'acts', name: 'Acts', chapter: 19, fromVerse: 27, toVerse: 41 },
  { abbr: 'acts', name: 'Acts', chapter: 20, fromVerse: 22, toVerse: 38 },
  { abbr: 'acts', name: 'Acts', chapter: 21, fromVerse: 36, toVerse: 40 },
  { abbr: 'acts', name: 'Acts', chapter: 23, fromVerse: 32, toVerse: 35 },
  { abbr: 'acts', name: 'Acts', chapter: 24, fromVerse: 16, toVerse: 27 },
  { abbr: 'acts', name: 'Acts', chapter: 26, fromVerse: 28, toVerse: 32 },
  { abbr: 'acts', name: 'Acts', chapter: 27, fromVerse: 35, toVerse: 44 },
  // Amos
  { abbr: 'am', name: 'Amos', chapter: 2, fromVerse: 15, toVerse: 16 },
  // Daniel
  { abbr: 'dn', name: 'Daniel', chapter: 2,  fromVerse: 41, toVerse: 49 },
  { abbr: 'dn', name: 'Daniel', chapter: 11, fromVerse: 41, toVerse: 45 },
  // Deuteronomy
  { abbr: 'dt', name: 'Deuteronomy', chapter: 1,  fromVerse: 17, toVerse: 46 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 4,  fromVerse: 40, toVerse: 49 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 5,  fromVerse: 33, toVerse: 33 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 6,  fromVerse: 17, toVerse: 25 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 9,  fromVerse: 26, toVerse: 29 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 13, fromVerse: 18, toVerse: 18 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 15, fromVerse: 23, toVerse: 23 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 23, fromVerse: 25, toVerse: 25 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 24, fromVerse: 20, toVerse: 22 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 28, fromVerse: 39, toVerse: 68 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 32, fromVerse: 41, toVerse: 52 },
  { abbr: 'dt', name: 'Deuteronomy', chapter: 34, fromVerse: 11, toVerse: 12 },
  // Ecclesiastes
  { abbr: 'eccl', name: 'Ecclesiastes', chapter: 3, fromVerse: 22, toVerse: 22 },
  { abbr: 'eccl', name: 'Ecclesiastes', chapter: 5, fromVerse: 20, toVerse: 20 },
  { abbr: 'eccl', name: 'Ecclesiastes', chapter: 6, fromVerse: 12, toVerse: 12 },
  // Ephesians
  { abbr: 'eph', name: 'Ephesians', chapter: 4, fromVerse: 25, toVerse: 32 },
  { abbr: 'eph', name: 'Ephesians', chapter: 5, fromVerse: 24, toVerse: 33 },
  // Exodus
  { abbr: 'ex', name: 'Exodus', chapter: 4,  fromVerse: 31, toVerse: 31 },
  { abbr: 'ex', name: 'Exodus', chapter: 5,  fromVerse: 23, toVerse: 23 },
  { abbr: 'ex', name: 'Exodus', chapter: 7,  fromVerse: 25, toVerse: 25 },
  { abbr: 'ex', name: 'Exodus', chapter: 10, fromVerse: 23, toVerse: 29 },
  { abbr: 'ex', name: 'Exodus', chapter: 12, fromVerse: 41, toVerse: 51 },
  { abbr: 'ex', name: 'Exodus', chapter: 16, fromVerse: 23, toVerse: 36 },
  { abbr: 'ex', name: 'Exodus', chapter: 19, fromVerse: 25, toVerse: 25 },
  { abbr: 'ex', name: 'Exodus', chapter: 21, fromVerse: 33, toVerse: 36 },
  { abbr: 'ex', name: 'Exodus', chapter: 26, fromVerse: 7,  toVerse: 37 },
  { abbr: 'ex', name: 'Exodus', chapter: 27, fromVerse: 11, toVerse: 21 },
  { abbr: 'ex', name: 'Exodus', chapter: 28, fromVerse: 22, toVerse: 43 },
  { abbr: 'ex', name: 'Exodus', chapter: 29, fromVerse: 41, toVerse: 46 },
  { abbr: 'ex', name: 'Exodus', chapter: 30, fromVerse: 37, toVerse: 38 },
  { abbr: 'ex', name: 'Exodus', chapter: 34, fromVerse: 35, toVerse: 35 },
  { abbr: 'ex', name: 'Exodus', chapter: 35, fromVerse: 4,  toVerse: 35 },
  { abbr: 'ex', name: 'Exodus', chapter: 36, fromVerse: 4,  toVerse: 38 },
  { abbr: 'ex', name: 'Exodus', chapter: 37, fromVerse: 2,  toVerse: 29 },
  { abbr: 'ex', name: 'Exodus', chapter: 39, fromVerse: 5,  toVerse: 43 },
  { abbr: 'ex', name: 'Exodus', chapter: 40, fromVerse: 3,  toVerse: 38 },
  // Ezekiel
  { abbr: 'ez', name: 'Ezekiel', chapter: 2,  fromVerse: 10, toVerse: 10 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 7,  fromVerse: 27, toVerse: 27 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 8,  fromVerse: 4,  toVerse: 18 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 9,  fromVerse: 10, toVerse: 11 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 11, fromVerse: 24, toVerse: 25 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 12, fromVerse: 23, toVerse: 28 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 13, fromVerse: 23, toVerse: 23 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 14, fromVerse: 23, toVerse: 23 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 15, fromVerse: 8,  toVerse: 8  },
  { abbr: 'ez', name: 'Ezekiel', chapter: 16, fromVerse: 40, toVerse: 63 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 18, fromVerse: 14, toVerse: 32 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 20, fromVerse: 2,  toVerse: 49 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 21, fromVerse: 32, toVerse: 32 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 22, fromVerse: 31, toVerse: 31 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 23, fromVerse: 41, toVerse: 49 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 25, fromVerse: 17, toVerse: 17 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 28, fromVerse: 4,  toVerse: 26 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 30, fromVerse: 21, toVerse: 26 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 31, fromVerse: 5,  toVerse: 18 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 36, fromVerse: 28, toVerse: 38 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 37, fromVerse: 27, toVerse: 28 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 38, fromVerse: 23, toVerse: 23 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 39, fromVerse: 29, toVerse: 29 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 40, fromVerse: 19, toVerse: 49 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 42, fromVerse: 7,  toVerse: 20 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 43, fromVerse: 27, toVerse: 27 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 44, fromVerse: 29, toVerse: 31 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 47, fromVerse: 23, toVerse: 23 },
  { abbr: 'ez', name: 'Ezekiel', chapter: 48, fromVerse: 2,  toVerse: 35 },
  // Ezra
  { abbr: 'ezr', name: 'Ezra', chapter: 2,  fromVerse: 4,  toVerse: 70 },
  { abbr: 'ezr', name: 'Ezra', chapter: 7,  fromVerse: 28, toVerse: 28 },
  { abbr: 'ezr', name: 'Ezra', chapter: 10, fromVerse: 31, toVerse: 44 },
  // Genesis
  { abbr: 'gn', name: 'Genesis', chapter: 5,  fromVerse: 10, toVerse: 32 },
  { abbr: 'gn', name: 'Genesis', chapter: 6,  fromVerse: 20, toVerse: 22 },
  { abbr: 'gn', name: 'Genesis', chapter: 10, fromVerse: 13, toVerse: 32 },
  { abbr: 'gn', name: 'Genesis', chapter: 11, fromVerse: 11, toVerse: 32 },
  { abbr: 'gn', name: 'Genesis', chapter: 15, fromVerse: 20, toVerse: 21 },
  { abbr: 'gn', name: 'Genesis', chapter: 18, fromVerse: 33, toVerse: 33 },
  { abbr: 'gn', name: 'Genesis', chapter: 19, fromVerse: 38, toVerse: 38 },
  { abbr: 'gn', name: 'Genesis', chapter: 20, fromVerse: 18, toVerse: 18 },
  { abbr: 'gn', name: 'Genesis', chapter: 21, fromVerse: 34, toVerse: 34 },
  { abbr: 'gn', name: 'Genesis', chapter: 24, fromVerse: 40, toVerse: 67 },
  { abbr: 'gn', name: 'Genesis', chapter: 27, fromVerse: 41, toVerse: 46 },
  { abbr: 'gn', name: 'Genesis', chapter: 30, fromVerse: 41, toVerse: 43 },
  { abbr: 'gn', name: 'Genesis', chapter: 31, fromVerse: 40, toVerse: 55 },
  { abbr: 'gn', name: 'Genesis', chapter: 36, fromVerse: 17, toVerse: 43 },
  { abbr: 'gn', name: 'Genesis', chapter: 39, fromVerse: 22, toVerse: 23 },
  { abbr: 'gn', name: 'Genesis', chapter: 41, fromVerse: 17, toVerse: 57 },
  { abbr: 'gn', name: 'Genesis', chapter: 44, fromVerse: 21, toVerse: 34 },
  { abbr: 'gn', name: 'Genesis', chapter: 49, fromVerse: 30, toVerse: 33 },
  // Habakkuk
  { abbr: 'hb', name: 'Habakkuk', chapter: 3, fromVerse: 19, toVerse: 19 },
  // Haggai
  { abbr: 'hg', name: 'Haggai', chapter: 1, fromVerse: 15, toVerse: 15 },
  // Hosea
  { abbr: 'hos', name: 'Hosea', chapter: 9,  fromVerse: 17, toVerse: 17 },
  { abbr: 'hos', name: 'Hosea', chapter: 10, fromVerse: 15, toVerse: 15 },
  { abbr: 'hos', name: 'Hosea', chapter: 13, fromVerse: 16, toVerse: 16 },
  // Isaiah
  { abbr: 'is', name: 'Isaiah', chapter: 4,  fromVerse: 6,  toVerse: 6  },
  { abbr: 'is', name: 'Isaiah', chapter: 7,  fromVerse: 25, toVerse: 25 },
  { abbr: 'is', name: 'Isaiah', chapter: 8,  fromVerse: 9,  toVerse: 22 },
  { abbr: 'is', name: 'Isaiah', chapter: 9,  fromVerse: 20, toVerse: 21 },
  { abbr: 'is', name: 'Isaiah', chapter: 19, fromVerse: 25, toVerse: 25 },
  { abbr: 'is', name: 'Isaiah', chapter: 21, fromVerse: 17, toVerse: 17 },
  { abbr: 'is', name: 'Isaiah', chapter: 25, fromVerse: 12, toVerse: 12 },
  { abbr: 'is', name: 'Isaiah', chapter: 28, fromVerse: 25, toVerse: 29 },
  { abbr: 'is', name: 'Isaiah', chapter: 34, fromVerse: 17, toVerse: 17 },
  { abbr: 'is', name: 'Isaiah', chapter: 36, fromVerse: 13, toVerse: 22 },
  { abbr: 'is', name: 'Isaiah', chapter: 37, fromVerse: 12, toVerse: 38 },
  { abbr: 'is', name: 'Isaiah', chapter: 42, fromVerse: 25, toVerse: 25 },
  { abbr: 'is', name: 'Isaiah', chapter: 54, fromVerse: 17, toVerse: 17 },
  { abbr: 'is', name: 'Isaiah', chapter: 56, fromVerse: 12, toVerse: 12 },
  { abbr: 'is', name: 'Isaiah', chapter: 57, fromVerse: 21, toVerse: 21 },
  { abbr: 'is', name: 'Isaiah', chapter: 62, fromVerse: 12, toVerse: 12 },
  { abbr: 'is', name: 'Isaiah', chapter: 64, fromVerse: 11, toVerse: 12 },
  // James
  { abbr: 'jas', name: 'James', chapter: 3, fromVerse: 18, toVerse: 18 },
  { abbr: 'jas', name: 'James', chapter: 4, fromVerse: 16, toVerse: 17 },
  // Jeremiah
  { abbr: 'jer', name: 'Jeremiah', chapter: 12, fromVerse: 17, toVerse: 17 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 19, fromVerse: 15, toVerse: 15 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 23, fromVerse: 40, toVerse: 40 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 26, fromVerse: 9,  toVerse: 24 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 27, fromVerse: 20, toVerse: 22 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 30, fromVerse: 24, toVerse: 24 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 32, fromVerse: 38, toVerse: 44 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 33, fromVerse: 26, toVerse: 26 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 36, fromVerse: 11, toVerse: 32 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 37, fromVerse: 21, toVerse: 21 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 38, fromVerse: 27, toVerse: 28 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 41, fromVerse: 18, toVerse: 18 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 42, fromVerse: 21, toVerse: 22 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 47, fromVerse: 7,  toVerse: 7  },
  { abbr: 'jer', name: 'Jeremiah', chapter: 48, fromVerse: 40, toVerse: 47 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 50, fromVerse: 40, toVerse: 46 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 51, fromVerse: 39, toVerse: 64 },
  { abbr: 'jer', name: 'Jeremiah', chapter: 52, fromVerse: 4,  toVerse: 34 },
  // Job
  { abbr: 'jb', name: 'Job', chapter: 12, fromVerse: 25, toVerse: 25 },
  { abbr: 'jb', name: 'Job', chapter: 33, fromVerse: 33, toVerse: 33 },
  { abbr: 'jb', name: 'Job', chapter: 38, fromVerse: 41, toVerse: 41 },
  // Joel
  { abbr: 'jl', name: 'Joel', chapter: 1, fromVerse: 19, toVerse: 20 },
  // John
  { abbr: 'jn', name: 'John', chapter: 4,  fromVerse: 28, toVerse: 54 },
  { abbr: 'jn', name: 'John', chapter: 5,  fromVerse: 26, toVerse: 47 },
  { abbr: 'jn', name: 'John', chapter: 7,  fromVerse: 28, toVerse: 53 },
  { abbr: 'jn', name: 'John', chapter: 8,  fromVerse: 54, toVerse: 59 },
  { abbr: 'jn', name: 'John', chapter: 10, fromVerse: 36, toVerse: 42 },
  { abbr: 'jn', name: 'John', chapter: 11, fromVerse: 36, toVerse: 57 },
  { abbr: 'jn', name: 'John', chapter: 12, fromVerse: 39, toVerse: 50 },
  { abbr: 'jn', name: 'John', chapter: 16, fromVerse: 19, toVerse: 33 },
  { abbr: 'jn', name: 'John', chapter: 18, fromVerse: 37, toVerse: 40 },
  { abbr: 'jn', name: 'John', chapter: 19, fromVerse: 41, toVerse: 42 },
  { abbr: 'jn', name: 'John', chapter: 20, fromVerse: 23, toVerse: 31 },
  // Joshua
  { abbr: 'jo', name: 'Joshua', chapter: 6,  fromVerse: 27, toVerse: 27 },
  { abbr: 'jo', name: 'Joshua', chapter: 10, fromVerse: 41, toVerse: 43 },
  { abbr: 'jo', name: 'Joshua', chapter: 11, fromVerse: 23, toVerse: 23 },
  { abbr: 'jo', name: 'Joshua', chapter: 13, fromVerse: 31, toVerse: 33 },
  { abbr: 'jo', name: 'Joshua', chapter: 15, fromVerse: 37, toVerse: 63 },
  { abbr: 'jo', name: 'Joshua', chapter: 19, fromVerse: 39, toVerse: 51 },
  { abbr: 'jo', name: 'Joshua', chapter: 21, fromVerse: 5,  toVerse: 45 },
  { abbr: 'jo', name: 'Joshua', chapter: 22, fromVerse: 25, toVerse: 34 },
  // Judges
  { abbr: 'jgs', name: 'Judges', chapter: 4,  fromVerse: 24, toVerse: 24 },
  { abbr: 'jgs', name: 'Judges', chapter: 9,  fromVerse: 38, toVerse: 57 },
  { abbr: 'jgs', name: 'Judges', chapter: 15, fromVerse: 20, toVerse: 20 },
  { abbr: 'jgs', name: 'Judges', chapter: 16, fromVerse: 10, toVerse: 31 },
  { abbr: 'jgs', name: 'Judges', chapter: 20, fromVerse: 6,  toVerse: 48 },
  // Lamentations
  { abbr: 'lam', name: 'Lamentations', chapter: 3, fromVerse: 40, toVerse: 66 },
  // Leviticus
  { abbr: 'lv', name: 'Leviticus', chapter: 2,  fromVerse: 15, toVerse: 16 },
  { abbr: 'lv', name: 'Leviticus', chapter: 4,  fromVerse: 14, toVerse: 35 },
  { abbr: 'lv', name: 'Leviticus', chapter: 8,  fromVerse: 15, toVerse: 36 },
  { abbr: 'lv', name: 'Leviticus', chapter: 10, fromVerse: 20, toVerse: 20 },
  { abbr: 'lv', name: 'Leviticus', chapter: 11, fromVerse: 41, toVerse: 47 },
  { abbr: 'lv', name: 'Leviticus', chapter: 13, fromVerse: 17, toVerse: 59 },
  { abbr: 'lv', name: 'Leviticus', chapter: 14, fromVerse: 22, toVerse: 57 },
  { abbr: 'lv', name: 'Leviticus', chapter: 15, fromVerse: 32, toVerse: 33 },
  { abbr: 'lv', name: 'Leviticus', chapter: 16, fromVerse: 32, toVerse: 34 },
  { abbr: 'lv', name: 'Leviticus', chapter: 17, fromVerse: 16, toVerse: 16 },
  { abbr: 'lv', name: 'Leviticus', chapter: 18, fromVerse: 30, toVerse: 30 },
  { abbr: 'lv', name: 'Leviticus', chapter: 19, fromVerse: 37, toVerse: 37 },
  { abbr: 'lv', name: 'Leviticus', chapter: 21, fromVerse: 24, toVerse: 24 },
  { abbr: 'lv', name: 'Leviticus', chapter: 22, fromVerse: 28, toVerse: 33 },
  { abbr: 'lv', name: 'Leviticus', chapter: 23, fromVerse: 41, toVerse: 44 },
  { abbr: 'lv', name: 'Leviticus', chapter: 24, fromVerse: 23, toVerse: 23 },
  { abbr: 'lv', name: 'Leviticus', chapter: 25, fromVerse: 15, toVerse: 55 },
  { abbr: 'lv', name: 'Leviticus', chapter: 26, fromVerse: 40, toVerse: 46 },
  // Luke
  { abbr: 'lk', name: 'Luke', chapter: 4,  fromVerse: 43, toVerse: 44 },
  { abbr: 'lk', name: 'Luke', chapter: 6,  fromVerse: 36, toVerse: 49 },
  { abbr: 'lk', name: 'Luke', chapter: 7,  fromVerse: 40, toVerse: 50 },
  { abbr: 'lk', name: 'Luke', chapter: 8,  fromVerse: 41, toVerse: 56 },
  { abbr: 'lk', name: 'Luke', chapter: 9,  fromVerse: 47, toVerse: 62 },
  { abbr: 'lk', name: 'Luke', chapter: 11, fromVerse: 47, toVerse: 54 },
  { abbr: 'lk', name: 'Luke', chapter: 12, fromVerse: 37, toVerse: 59 },
  { abbr: 'lk', name: 'Luke', chapter: 13, fromVerse: 35, toVerse: 35 },
  { abbr: 'lk', name: 'Luke', chapter: 15, fromVerse: 31, toVerse: 32 },
  { abbr: 'lk', name: 'Luke', chapter: 17, fromVerse: 31, toVerse: 37 },
  { abbr: 'lk', name: 'Luke', chapter: 19, fromVerse: 41, toVerse: 48 },
  { abbr: 'lk', name: 'Luke', chapter: 20, fromVerse: 46, toVerse: 47 },
  { abbr: 'lk', name: 'Luke', chapter: 21, fromVerse: 27, toVerse: 38 },
  { abbr: 'lk', name: 'Luke', chapter: 22, fromVerse: 35, toVerse: 71 },
  { abbr: 'lk', name: 'Luke', chapter: 23, fromVerse: 36, toVerse: 56 },
  { abbr: 'lk', name: 'Luke', chapter: 24, fromVerse: 47, toVerse: 53 },
  // Malachi
  { abbr: 'mal', name: 'Malachi', chapter: 3, fromVerse: 18, toVerse: 18 },
  // Matthew
  { abbr: 'mt', name: 'Matthew', chapter: 6,  fromVerse: 32, toVerse: 34 },
  { abbr: 'mt', name: 'Matthew', chapter: 8,  fromVerse: 26, toVerse: 34 },
  { abbr: 'mt', name: 'Matthew', chapter: 9,  fromVerse: 37, toVerse: 38 },
  { abbr: 'mt', name: 'Matthew', chapter: 10, fromVerse: 33, toVerse: 42 },
  { abbr: 'mt', name: 'Matthew', chapter: 11, fromVerse: 23, toVerse: 30 },
  { abbr: 'mt', name: 'Matthew', chapter: 12, fromVerse: 22, toVerse: 50 },
  { abbr: 'mt', name: 'Matthew', chapter: 13, fromVerse: 30, toVerse: 58 },
  { abbr: 'mt', name: 'Matthew', chapter: 15, fromVerse: 34, toVerse: 39 },
  { abbr: 'mt', name: 'Matthew', chapter: 16, fromVerse: 23, toVerse: 28 },
  { abbr: 'mt', name: 'Matthew', chapter: 18, fromVerse: 26, toVerse: 35 },
  { abbr: 'mt', name: 'Matthew', chapter: 19, fromVerse: 27, toVerse: 30 },
  { abbr: 'mt', name: 'Matthew', chapter: 20, fromVerse: 17, toVerse: 34 },
  { abbr: 'mt', name: 'Matthew', chapter: 21, fromVerse: 27, toVerse: 46 },
  { abbr: 'mt', name: 'Matthew', chapter: 22, fromVerse: 26, toVerse: 45 },
  { abbr: 'mt', name: 'Matthew', chapter: 23, fromVerse: 28, toVerse: 39 },
  { abbr: 'mt', name: 'Matthew', chapter: 24, fromVerse: 28, toVerse: 51 },
  { abbr: 'mt', name: 'Matthew', chapter: 25, fromVerse: 29, toVerse: 46 },
  { abbr: 'mt', name: 'Matthew', chapter: 26, fromVerse: 28, toVerse: 74 },
  { abbr: 'mt', name: 'Matthew', chapter: 27, fromVerse: 25, toVerse: 66 },
  // Micah
  { abbr: 'mi', name: 'Micah', chapter: 5, fromVerse: 15, toVerse: 15 },
  // Nahum
  { abbr: 'na', name: 'Nahum', chapter: 2, fromVerse: 7,  toVerse: 13 },
  { abbr: 'na', name: 'Nahum', chapter: 3, fromVerse: 9,  toVerse: 19 },
  // Nehemiah
  { abbr: 'neh', name: 'Nehemiah', chapter: 3,  fromVerse: 30, toVerse: 32 },
  { abbr: 'neh', name: 'Nehemiah', chapter: 7,  fromVerse: 14, toVerse: 73 },
  { abbr: 'neh', name: 'Nehemiah', chapter: 10, fromVerse: 15, toVerse: 39 },
  { abbr: 'neh', name: 'Nehemiah', chapter: 12, fromVerse: 39, toVerse: 47 },
  // Numbers
  { abbr: 'nm', name: 'Numbers', chapter: 1,  fromVerse: 8,  toVerse: 54 },
  { abbr: 'nm', name: 'Numbers', chapter: 2,  fromVerse: 3,  toVerse: 34 },
  { abbr: 'nm', name: 'Numbers', chapter: 3,  fromVerse: 40, toVerse: 51 },
  { abbr: 'nm', name: 'Numbers', chapter: 4,  fromVerse: 28, toVerse: 49 },
  { abbr: 'nm', name: 'Numbers', chapter: 6,  fromVerse: 12, toVerse: 27 },
  { abbr: 'nm', name: 'Numbers', chapter: 7,  fromVerse: 15, toVerse: 89 },
  { abbr: 'nm', name: 'Numbers', chapter: 10, fromVerse: 22, toVerse: 36 },
  { abbr: 'nm', name: 'Numbers', chapter: 11, fromVerse: 35, toVerse: 35 },
  { abbr: 'nm', name: 'Numbers', chapter: 12, fromVerse: 15, toVerse: 16 },
  { abbr: 'nm', name: 'Numbers', chapter: 14, fromVerse: 38, toVerse: 45 },
  { abbr: 'nm', name: 'Numbers', chapter: 15, fromVerse: 5,  toVerse: 41 },
  { abbr: 'nm', name: 'Numbers', chapter: 16, fromVerse: 16, toVerse: 50 },
  { abbr: 'nm', name: 'Numbers', chapter: 21, fromVerse: 34, toVerse: 35 },
  { abbr: 'nm', name: 'Numbers', chapter: 22, fromVerse: 9,  toVerse: 41 },
  { abbr: 'nm', name: 'Numbers', chapter: 23, fromVerse: 29, toVerse: 30 },
  { abbr: 'nm', name: 'Numbers', chapter: 25, fromVerse: 18, toVerse: 18 },
  { abbr: 'nm', name: 'Numbers', chapter: 26, fromVerse: 39, toVerse: 65 },
  { abbr: 'nm', name: 'Numbers', chapter: 28, fromVerse: 17, toVerse: 31 },
  { abbr: 'nm', name: 'Numbers', chapter: 29, fromVerse: 13, toVerse: 40 },
  { abbr: 'nm', name: 'Numbers', chapter: 30, fromVerse: 8,  toVerse: 16 },
  { abbr: 'nm', name: 'Numbers', chapter: 31, fromVerse: 33, toVerse: 54 },
  { abbr: 'nm', name: 'Numbers', chapter: 32, fromVerse: 41, toVerse: 42 },
  { abbr: 'nm', name: 'Numbers', chapter: 33, fromVerse: 38, toVerse: 56 },
  { abbr: 'nm', name: 'Numbers', chapter: 34, fromVerse: 18, toVerse: 29 },
  { abbr: 'nm', name: 'Numbers', chapter: 35, fromVerse: 34, toVerse: 34 },
  { abbr: 'nm', name: 'Numbers', chapter: 36, fromVerse: 12, toVerse: 13 },
  // Philippians
  { abbr: 'phil', name: 'Philippians', chapter: 2, fromVerse: 24, toVerse: 30 },
  // Proverbs
  { abbr: 'prv', name: 'Proverbs', chapter: 2,  fromVerse: 22, toVerse: 22 },
  { abbr: 'prv', name: 'Proverbs', chapter: 10, fromVerse: 31, toVerse: 32 },
  { abbr: 'prv', name: 'Proverbs', chapter: 26, fromVerse: 28, toVerse: 28 },
  { abbr: 'prv', name: 'Proverbs', chapter: 29, fromVerse: 26, toVerse: 27 },
  // Psalms
  { abbr: 'ps', name: 'Psalms', chapter: 18,  fromVerse: 41,  toVerse: 50  },
  { abbr: 'ps', name: 'Psalms', chapter: 72,  fromVerse: 20,  toVerse: 20  },
  { abbr: 'ps', name: 'Psalms', chapter: 78,  fromVerse: 41,  toVerse: 72  },
  { abbr: 'ps', name: 'Psalms', chapter: 89,  fromVerse: 41,  toVerse: 52  },
  { abbr: 'ps', name: 'Psalms', chapter: 105, fromVerse: 41,  toVerse: 45  },
  { abbr: 'ps', name: 'Psalms', chapter: 106, fromVerse: 41,  toVerse: 48  },
  { abbr: 'ps', name: 'Psalms', chapter: 107, fromVerse: 10,  toVerse: 43  },
  { abbr: 'ps', name: 'Psalms', chapter: 108, fromVerse: 8,   toVerse: 13  },
  { abbr: 'ps', name: 'Psalms', chapter: 109, fromVerse: 31,  toVerse: 31  },
  { abbr: 'ps', name: 'Psalms', chapter: 119, fromVerse: 41,  toVerse: 176 },
  { abbr: 'ps', name: 'Psalms', chapter: 136, fromVerse: 17,  toVerse: 26  },
  // Revelation
  { abbr: 'rv', name: 'Revelation', chapter: 2,  fromVerse: 29, toVerse: 29 },
  { abbr: 'rv', name: 'Revelation', chapter: 3,  fromVerse: 22, toVerse: 22 },
  { abbr: 'rv', name: 'Revelation', chapter: 4,  fromVerse: 11, toVerse: 11 },
  { abbr: 'rv', name: 'Revelation', chapter: 5,  fromVerse: 13, toVerse: 14 },
  { abbr: 'rv', name: 'Revelation', chapter: 6,  fromVerse: 16, toVerse: 17 },
  { abbr: 'rv', name: 'Revelation', chapter: 9,  fromVerse: 21, toVerse: 21 },
  { abbr: 'rv', name: 'Revelation', chapter: 12, fromVerse: 18, toVerse: 18 },
  { abbr: 'rv', name: 'Revelation', chapter: 17, fromVerse: 18, toVerse: 18 },
  { abbr: 'rv', name: 'Revelation', chapter: 18, fromVerse: 23, toVerse: 24 },
  { abbr: 'rv', name: 'Revelation', chapter: 19, fromVerse: 21, toVerse: 21 },
  { abbr: 'rv', name: 'Revelation', chapter: 22, fromVerse: 21, toVerse: 21 },
  // Romans
  { abbr: 'rom', name: 'Romans', chapter: 16, fromVerse: 25, toVerse: 27 },
  // Ruth
  { abbr: 'ru', name: 'Ruth', chapter: 2, fromVerse: 13, toVerse: 23 },
  { abbr: 'ru', name: 'Ruth', chapter: 3, fromVerse: 17, toVerse: 18 },
  // Zechariah
  { abbr: 'zec', name: 'Zechariah', chapter: 7,  fromVerse: 14, toVerse: 14 },
  { abbr: 'zec', name: 'Zechariah', chapter: 10, fromVerse: 12, toVerse: 12 },
  { abbr: 'zec', name: 'Zechariah', chapter: 12, fromVerse: 14, toVerse: 14 },
  // Zephaniah
  { abbr: 'zep', name: 'Zephaniah', chapter: 3, fromVerse: 20, toVerse: 20 },
]

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://www.catenabible.com',
        'Referer': 'https://www.catenabible.com/'
      }
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson(res.headers.location!).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    }).on('error', reject)
  })
}

function normalizeEntry(raw: any, bookName: string, chapter: number, verse: number): any | null {
  if (!raw || typeof raw !== 'object') return null
  const father = raw.father || {}
  const fatherName = father.fullName || (father.en && father.en.name) || ''
  const text = (raw.commentary || '').replace(/&#\d+;/g, (c: string) => {
    const code = parseInt(c.slice(2, -1))
    return String.fromCharCode(code)
  }).replace(/\s+/g, ' ').trim()
  if (!fatherName || !text || text.length < 20) return null
  const tag = father.tag || 'EF'
  const eraInfo = ERA_MAP[tag] || { era: 'Early Church', order: 5 }
  const infoUrl = father.infoUrl || (father.en && father.en.infoUrl) || ''
  return {
    book: bookName,
    chapter,
    verse,
    father_name: fatherName,
    father_era: eraInfo.era,
    father_era_order: eraInfo.order,
    excerpt: text.length > 220 ? text.slice(0, 217) + '…' : text,
    full_text: text,
    source: `Commentary on ${bookName} ${chapter}:${verse} (catenabible.com)`,
    source_url: infoUrl
  }
}

async function fetchVerse(abbr: string, bookName: string, chapter: number, verse: number): Promise<any[]> {
  const url = `${API_BASE}/anc_com/c/${abbr}/${chapter}/${verse}?tags=["ALL"]&sort=era`
  try {
    const data = await fetchJson(url)
    if (!data || !Array.isArray(data)) return []
    return data
      .map((raw: any) => normalizeEntry(raw, bookName, chapter, verse))
      .filter(Boolean)
  } catch {
    return []
  }
}

async function main() {
  // Load progress (separate from original fetch progress)
  let progress: Record<string, boolean> = {}
  if (fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'))
    const done = Object.values(progress).filter(Boolean).length
    console.log(`Resuming — ${done} gaps already completed`)
  }

  // Load existing entries and build dedup set
  let allEntries: any[] = []
  if (fs.existsSync(OUT_PATH)) {
    allEntries = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'))
    console.log(`Loaded ${allEntries.length} existing entries`)
  }

  const dedup = new Set<string>()
  for (const e of allEntries) {
    dedup.add(`${e.book}|${e.chapter}|${e.verse}|${e.father_name}`)
  }

  let totalNew = 0

  for (const gap of GAPS) {
    const progressKey = `${gap.abbr}_${gap.chapter}`
    if (progress[progressKey]) {
      process.stdout.write('.')
      continue
    }

    let gapNew = 0
    process.stdout.write(`\n${gap.name} ${gap.chapter}:${gap.fromVerse}-${gap.toVerse} `)

    for (let v = gap.fromVerse; v <= gap.toVerse; v++) {
      const entries = await fetchVerse(gap.abbr, gap.name, gap.chapter, v)
      for (const entry of entries) {
        const key = `${entry.book}|${entry.chapter}|${entry.verse}|${entry.father_name}`
        if (!dedup.has(key)) {
          dedup.add(key)
          allEntries.push(entry)
          gapNew++
        }
      }
      await sleep(200)
    }

    process.stdout.write(`→ +${gapNew}`)
    totalNew += gapNew

    progress[progressKey] = true
    fs.writeFileSync(OUT_PATH, JSON.stringify(allEntries, null, 2))
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))

    await sleep(300)
  }

  console.log(`\n\nDone! Added ${totalNew} new entries. Total: ${allEntries.length}`)
  console.log('Now run: npm run build-db')
}

main().catch(console.error)
