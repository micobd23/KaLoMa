import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  },
)

export type FoodItem = {
  id?: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type LogEntry = {
  id: string
  date: string
  meal: string
  name: string
  amount: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Goals {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

export const MEALS = [
  { key: 'frühstück',   label: '☀️ Frühstück' },
  { key: 'mittagessen', label: '🌤 Mittagessen' },
  { key: 'abendessen',  label: '🌙 Abendessen' },
  { key: 'snack',       label: '🍎 Snack' },
] as const

export type MealKey = typeof MEALS[number]['key']

export function r(v: number) { return Math.round(v * 10) / 10 }
export function decimalInput(v: string) { return v.replace(',', '.') }
export function kj(kcal: number) { return Math.round(kcal * 4.184) }
export function be(carbs: number) { return Math.round((carbs / 12) * 100) / 100 }
export function dateKey(d: Date) { return d.toISOString().split('T')[0] }
export function formatDate(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = (d.getTime() - today.getTime()) / 86400000
  if (diff === 0) return 'Heute'
  if (diff === -1) return 'Gestern'
  if (diff === 1) return 'Morgen'
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}
