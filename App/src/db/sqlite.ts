// expo-sqlite-shaped wrapper over the main process's better-sqlite3 handles, so the
// query layer ported from the Android app (queries.ts) runs here unchanged.

type Param = string | number | null | boolean | undefined
type Params = Param[] | Param

function norm(p: Params[]): (string | number | null)[] {
  const flat = p.length === 1 && Array.isArray(p[0]) ? p[0] : (p as Param[])
  return flat.map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v))
}

export class SQLiteDatabase {
  constructor(private which: 'bible' | 'user') {}

  getAllAsync<T = any>(sql: string, ...params: Params[]): Promise<T[]> {
    return window.api.sql(this.which, 'all', sql, norm(params))
  }

  getFirstAsync<T = any>(sql: string, ...params: Params[]): Promise<T | null> {
    return window.api.sql(this.which, 'get', sql, norm(params))
  }

  runAsync(sql: string, ...params: Params[]): Promise<{ changes: number; lastInsertRowId: number }> {
    return window.api.sql(this.which, 'run', sql, norm(params))
  }

  async execAsync(sql: string): Promise<void> {
    await window.api.sql(this.which, 'exec', sql)
  }

  // ponytail: BEGIN/COMMIT over IPC; other writes issued meanwhile join the transaction.
  // Fine for the one caller (plan creation); add a main-side batch call if that changes.
  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    await this.execAsync('BEGIN')
    try { await fn(); await this.execAsync('COMMIT') }
    catch (e) { await this.execAsync('ROLLBACK'); throw e }
  }
}

export const bibleDb = new SQLiteDatabase('bible')
export const userDb = new SQLiteDatabase('user')
