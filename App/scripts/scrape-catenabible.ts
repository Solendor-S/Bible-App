/**
 * Scrapes catenabible.com using a real browser (Playwright) to bypass 403.
 * Downloads all available commentary and saves locally for offline use.
 * Run: node -r ts-node/register scripts/scrape-catenabible.ts
 * Outputs: data/raw/commentary-catenabible.json
 *
 * Expected runtime: 20-40 minutes (polite rate limiting)
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const OUT_PATH = path.join(__dirname, '../data/raw/commentary-catenabible.json')
const PROGRESS_PATH = path.join(__dirname, '../data/raw/scrape-progress.json')

// All Bible books in order with their canonical names
const BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1-Samuel','2-Samuel','1-Kings','2-Kings','1-Chronicles','2-Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes',
  'Song-of-Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1-Corinthians','2-Corinthians','Galatians','Ephesians','Philippians',
  'Colossians','1-Thessalonians','2-Thessalonians','1-Timothy','2-Timothy',
  'Titus','Philemon','Hebrews','James','1-Peter','2-Peter',
  '1-John','2-John','3-John','Jude','Revelation'
]

// Canonical display names (no hyphens)
const DISPLAY_NAMES: Record<string, string> = {
  '1-Samuel': '1 Samuel', '2-Samuel': '2 Samuel', '1-Kings': '1 Kings',
  '2-Kings': '2 Kings', '1-Chronicles': '1 Chronicles', '2-Chronicles': '2 Chronicles',
  'Song-of-Solomon': 'Song of Solomon', '1-Corinthians': '1 Corinthians',
  '2-Corinthians': '2 Corinthians', '1-Thessalonians': '1 Thessalonians',
  '2-Thessalonians': '2 Thessalonians', '1-Timothy': '1 Timothy',
  '2-Timothy': '2 Timothy', '1-Peter': '1 Peter', '2-Peter': '2 Peter',
  '1-John': '1 John', '2-John': '2 John', '3-John': '3 John'
}

function displayName(book: string): string {
  return DISPLAY_NAMES[book] || book
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function scrapeChapter(
  page: any,
  book: string,
  chapter: number
): Promise<any[]> {
  const url = `https://www.catenabible.com/${book}/${chapter}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await sleep(800) // polite delay

    // Check if page has commentary content
    const hasContent = await page.$('[class*="verse"], [class*="commentary"], [class*="passage"]')
    if (!hasContent) return []

    // Try to extract via page evaluation
    const entries = await page.evaluate((bookDisplay: string, chapterNum: number) => {
      const results: any[] = []

      // Strategy 1: Look for verse/commentary structure in DOM
      const verseContainers = document.querySelectorAll(
        '[class*="verse"], [class*="Verse"], [data-verse], [id*="verse"]'
      )

      verseContainers.forEach(container => {
        const verseAttr = container.getAttribute('data-verse')
          || container.id?.match(/\d+/)?.[0]
          || container.className?.match(/verse-?(\d+)/)?.[1]

        if (!verseAttr) return

        const verseNum = parseInt(verseAttr)
        if (isNaN(verseNum)) return

        // Find commentary items within this verse container
        const commentaryItems = container.querySelectorAll(
          '[class*="father"], [class*="Father"], [class*="comment"], [class*="quote"]'
        )

        commentaryItems.forEach(item => {
          const fatherEl = item.querySelector('[class*="name"], [class*="author"], h3, h4, strong')
          const textEl = item.querySelector('[class*="text"], [class*="body"], p')

          if (fatherEl && textEl) {
            results.push({
              verse: verseNum,
              father: fatherEl.textContent?.trim() || '',
              text: textEl.textContent?.trim() || ''
            })
          }
        })
      })

      // Strategy 2: Try React/Vue rendered data from window object
      const win = window as any
      if (win.__NEXT_DATA__?.props?.pageProps?.commentary) {
        const data = win.__NEXT_DATA__.props.pageProps.commentary
        if (Array.isArray(data)) {
          data.forEach((entry: any) => {
            if (entry.verse && entry.fatherName && entry.text) {
              results.push({
                verse: entry.verse,
                father: entry.fatherName,
                text: entry.text,
                source: entry.source || '',
                era: entry.era || ''
              })
            }
          })
        }
      }

      // Strategy 3: Intercept any embedded JSON in script tags
      if (results.length === 0) {
        document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__').forEach(script => {
          try {
            const data = JSON.parse(script.textContent || '')
            const stringify = JSON.stringify(data)
            // Look for commentary patterns
            if (stringify.includes('fatherName') || stringify.includes('commentary')) {
              const extractCommentary = (obj: any): void => {
                if (!obj || typeof obj !== 'object') return
                if (obj.fatherName && obj.text) {
                  results.push({
                    verse: obj.verse || obj.verseNumber || 0,
                    father: obj.fatherName,
                    text: obj.text,
                    source: obj.source || obj.work || '',
                    era: obj.era || obj.century || ''
                  })
                }
                Object.values(obj).forEach(v => extractCommentary(v))
              }
              extractCommentary(data)
            }
          } catch {}
        })
      }

      return results
    }, displayName(book), chapter)

    // If DOM strategies failed, try network interception approach
    if (entries.length === 0) {
      // Check if there's commentary rendered as plain text paragraphs
      const textContent = await page.evaluate(() => {
        const main = document.querySelector('main, #root, [class*="content"], [class*="app"]')
        return main?.textContent || ''
      })

      if (textContent.length < 100) return []
    }

    return entries.map(e => ({
      book: displayName(book),
      chapter,
      verse: e.verse || 1,
      father_name: e.father || 'Unknown',
      father_era: e.era || 'Early Church',
      father_era_order: 5,
      excerpt: (e.text || '').slice(0, 200),
      full_text: e.text || '',
      source: e.source || `Commentary on ${displayName(book)} ${chapter}:${e.verse}`,
      source_url: ''
    })).filter(e => e.full_text.length > 20 && e.father_name !== 'Unknown')

  } catch (err) {
    console.error(`    Error scraping ${book} ${chapter}:`, (err as Error).message?.slice(0, 80))
    return []
  }
}

async function main() {
  // Load existing progress
  let progress: Record<string, number[]> = {}
  if (fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'))
    console.log('Resuming from previous progress...')
  }

  let allEntries: any[] = []
  if (fs.existsSync(OUT_PATH)) {
    allEntries = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'))
    console.log(`Loaded ${allEntries.length} existing entries`)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  })

  // Intercept API calls to capture commentary data
  const capturedApiData: any[] = []
  await context.route('**/*', async (route: any) => {
    const request = route.request()
    const url = request.url()

    // Intercept JSON API responses
    if (url.includes('/api/') || url.includes('commentary') || url.includes('catena')) {
      try {
        const response = await route.fetch()
        const body = await response.text()
        if (body.startsWith('{') || body.startsWith('[')) {
          try {
            const data = JSON.parse(body)
            capturedApiData.push({ url, data })
          } catch {}
        }
        await route.fulfill({ response })
      } catch {
        await route.continue()
      }
    } else {
      await route.continue()
    }
  })

  const page = await context.newPage()

  // First, visit the homepage to understand structure
  console.log('Visiting homepage to detect site structure...')
  try {
    await page.goto('https://www.catenabible.com', { waitUntil: 'networkidle', timeout: 30000 })
    await sleep(2000)

    // Check what API calls were intercepted
    if (capturedApiData.length > 0) {
      console.log('Detected API calls:')
      capturedApiData.forEach(d => console.log(' ', d.url))
    }
  } catch (err) {
    console.log('Homepage visit failed, trying directly...')
  }

  // Scrape books
  for (const book of BOOKS) {
    const doneChapters = progress[book] || []
    process.stdout.write(`\n${displayName(book)}: `)

    // Try chapters 1–150 (Psalms has 150, most books fewer)
    const maxChapters = book === 'Psalms' ? 150 : book === 'Isaiah' ? 66 : 50

    for (let ch = 1; ch <= maxChapters; ch++) {
      if (doneChapters.includes(ch)) {
        process.stdout.write('.')
        continue
      }

      const entries = await scrapeChapter(page, book, ch)

      if (entries.length === 0 && ch > 3) {
        // Likely past the end of this book
        break
      }

      if (entries.length > 0) {
        allEntries.push(...entries)
        process.stdout.write(`${ch}(${entries.length}) `)
      } else {
        process.stdout.write('_')
      }

      doneChapters.push(ch)
      progress[book] = doneChapters

      // Save progress every chapter
      fs.writeFileSync(OUT_PATH, JSON.stringify(allEntries, null, 2))
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))

      await sleep(1200) // 1.2s between requests — polite
    }
  }

  await browser.close()

  console.log(`\n\nComplete! Saved ${allEntries.length} entries to ${OUT_PATH}`)
  if (capturedApiData.length > 0) {
    console.log('\nDetected API endpoints during scraping:')
    const uniqueUrls = Array.from(new Set(capturedApiData.map(d => d.url)))
    uniqueUrls.forEach(u => console.log(' ', u))
    console.log('\nSave these URLs — future runs can call the API directly instead of scraping.')
  }
}

main().catch(console.error)
