// Runs a Python data script with the right interpreter: $PYTHON if set, else the project's
// Python 3.14 install when present, else whatever `py -3` / `python3` resolves to.
//   node scripts/py.js data/import-android.py [args…]
const { spawnSync } = require('child_process')
const { existsSync } = require('fs')

const KNOWN = 'C:\\Users\\Sargo\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe'
const [cmd, ...pre] = process.env.PYTHON ? [process.env.PYTHON]
  : existsSync(KNOWN) ? [KNOWN]
  : process.platform === 'win32' ? ['py', '-3'] : ['python3']

const r = spawnSync(cmd, [...pre, ...process.argv.slice(2)], { stdio: 'inherit' })
if (r.error) { console.error(`Could not run Python (${cmd}): ${r.error.message}. Set PYTHON to your interpreter.`); process.exit(1) }
process.exit(r.status ?? 1)
