// Page data for the standard 604-page Madani mushaf. Memorisation is tracked
// by page, so juz/surah boundaries that fall mid-page are rounded to whole
// pages (a shared page counts towards the surah that starts on it).

import type { StudentRecordBundle } from './types'

export const TOTAL_PAGES = 604
export const TOTAL_JUZ = 30

/** First page of each juz (index 0 = juz 1). */
const JUZ_START = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462,
  482, 502, 522, 542, 562, 582,
]

/** [name, first page] for each surah, in order (index 0 = surah 1). */
const SURAH_DATA: [string, number][] = [
  ['Al-Fatihah', 1], ['Al-Baqarah', 2], ['Al Imran', 50], ['An-Nisa', 77], ['Al-Maidah', 106],
  ["Al-An'am", 128], ["Al-A'raf", 151], ['Al-Anfal', 177], ['At-Tawbah', 187], ['Yunus', 208],
  ['Hud', 221], ['Yusuf', 235], ["Ar-Ra'd", 249], ['Ibrahim', 255], ['Al-Hijr', 262],
  ['An-Nahl', 267], ['Al-Isra', 282], ['Al-Kahf', 293], ['Maryam', 305], ['Ta-Ha', 312],
  ['Al-Anbiya', 322], ['Al-Hajj', 332], ["Al-Mu'minun", 342], ['An-Nur', 350], ['Al-Furqan', 359],
  ["Ash-Shu'ara", 367], ['An-Naml', 377], ['Al-Qasas', 385], ['Al-Ankabut', 396], ['Ar-Rum', 404],
  ['Luqman', 411], ['As-Sajdah', 415], ['Al-Ahzab', 418], ['Saba', 428], ['Fatir', 434],
  ['Ya-Sin', 440], ['As-Saffat', 446], ['Sad', 453], ['Az-Zumar', 458], ['Ghafir', 467],
  ['Fussilat', 477], ['Ash-Shura', 483], ['Az-Zukhruf', 489], ['Ad-Dukhan', 496], ['Al-Jathiyah', 499],
  ['Al-Ahqaf', 502], ['Muhammad', 507], ['Al-Fath', 511], ['Al-Hujurat', 515], ['Qaf', 518],
  ['Adh-Dhariyat', 520], ['At-Tur', 523], ['An-Najm', 526], ['Al-Qamar', 528], ['Ar-Rahman', 531],
  ["Al-Waqi'ah", 534], ['Al-Hadid', 537], ['Al-Mujadilah', 542], ['Al-Hashr', 545], ['Al-Mumtahanah', 549],
  ['As-Saff', 551], ["Al-Jumu'ah", 553], ['Al-Munafiqun', 554], ['At-Taghabun', 556], ['At-Talaq', 558],
  ['At-Tahrim', 560], ['Al-Mulk', 562], ['Al-Qalam', 564], ['Al-Haqqah', 566], ["Al-Ma'arij", 568],
  ['Nuh', 570], ['Al-Jinn', 572], ['Al-Muzzammil', 574], ['Al-Muddaththir', 575], ['Al-Qiyamah', 577],
  ['Al-Insan', 578], ['Al-Mursalat', 580], ['An-Naba', 582], ["An-Nazi'at", 583], ['Abasa', 585],
  ['At-Takwir', 586], ['Al-Infitar', 587], ['Al-Mutaffifin', 587], ['Al-Inshiqaq', 589], ['Al-Buruj', 590],
  ['At-Tariq', 591], ["Al-A'la", 591], ['Al-Ghashiyah', 592], ['Al-Fajr', 593], ['Al-Balad', 594],
  ['Ash-Shams', 595], ['Al-Layl', 595], ['Ad-Duha', 596], ['Ash-Sharh', 596], ['At-Tin', 597],
  ["Al-'Alaq", 597], ['Al-Qadr', 598], ['Al-Bayyinah', 598], ['Az-Zalzalah', 599], ["Al-'Adiyat", 599],
  ["Al-Qari'ah", 600], ['At-Takathur', 600], ["Al-'Asr", 601], ['Al-Humazah', 601], ['Al-Fil', 601],
  ['Quraysh', 602], ["Al-Ma'un", 602], ['Al-Kawthar', 602], ['Al-Kafirun', 603], ['An-Nasr', 603],
  ['Al-Masad', 603], ['Al-Ikhlas', 604], ['Al-Falaq', 604], ['An-Nas', 604],
]

export interface Surah {
  number: number
  name: string
  startPage: number
  endPage: number
}

export const SURAHS: Surah[] = SURAH_DATA.map(([name, startPage], i) => {
  const next = SURAH_DATA[i + 1]?.[1] ?? TOTAL_PAGES + 1
  return { number: i + 1, name, startPage, endPage: Math.max(startPage, next - 1) }
})

export function juzPageRange(juz: number): [number, number] {
  const start = JUZ_START[juz - 1]
  const end = juz === TOTAL_JUZ ? TOTAL_PAGES : JUZ_START[juz] - 1
  return [start, end]
}

export function pageRange(from: number, to: number): number[] {
  const out: number[] = []
  for (let p = from; p <= to; p++) out.push(p)
  return out
}

export function juzOfPage(page: number): number {
  let juz = 1
  for (let j = 0; j < JUZ_START.length; j++) if (page >= JUZ_START[j]) juz = j + 1
  return juz
}

/** Surahs that have at least one page inside the given juz. */
export function surahsInJuz(juz: number): Surah[] {
  const [start, end] = juzPageRange(juz)
  return SURAHS.filter((s) => s.startPage <= end && s.endPage >= start)
}

export interface JuzProgress {
  juz: number
  done: number
  total: number
  pct: number
}

export function juzProgress(memorised: Set<number>): JuzProgress[] {
  return Array.from({ length: TOTAL_JUZ }, (_, i) => {
    const [start, end] = juzPageRange(i + 1)
    let done = 0
    for (let p = start; p <= end; p++) if (memorised.has(p)) done++
    const total = end - start + 1
    return { juz: i + 1, done, total, pct: Math.round((done / total) * 100) }
  })
}

/** Pages known on joining plus every page range entered in weekly records. */
export function memorisedPages(bundle: StudentRecordBundle): Set<number> {
  const set = new Set<number>(bundle.student.prior_pages ?? [])
  for (const r of bundle.records) {
    if (r.status !== 'present' || r.hifz_from_page == null) continue
    const to = r.hifz_to_page ?? r.hifz_from_page
    for (let p = r.hifz_from_page; p <= to; p++) set.add(p)
  }
  return set
}

/** Shade bucket (0–4) for a percentage, used to colour juz tiles and page cells. */
export function shadeLevel(pct: number): 0 | 1 | 2 | 3 | 4 {
  if (pct <= 0) return 0
  if (pct < 34) return 1
  if (pct < 67) return 2
  if (pct < 100) return 3
  return 4
}
