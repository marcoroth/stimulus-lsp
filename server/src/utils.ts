import { levenshtein } from "./levenshtein"

function rank(input: string, list: string[]) {
  return list
    .map((item) => {
      const score = levenshtein(input.toLowerCase(), item.toLowerCase())

      return { item, score }
    })
    .sort((a, b) => a.score - b.score)
}

export function didyoumean(input: string, list: string[]): string | null {
  if (list.length === 0) return null

  const scores = rank(input, list)

  if (scores.length === 0) return null

  return scores[0].item
}

export function camelize(value: string) {
  return value.replace(/(?:[_-])([a-z0-9])/g, (_, char) => char.toUpperCase())
}

export function dasherize(value: string) {
  return value.replace(/([A-Z])/g, (_, char) => `-${char.toLowerCase()}`)
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
