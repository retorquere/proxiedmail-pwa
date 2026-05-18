import modelJson from './name_model.json'

type Model = {
  starts: Record<string, string[]>
  transitions: Record<string, Record<string, (string | null)[]>>
}

const model = modelJson as unknown as Model

export function generate(type: 'given' | 'surname', minLen = 5, maxLen = 9): string {
  const pool = model.starts[type] ?? []
  const map = model.transitions[type] ?? {}

  for (let attempt = 0; attempt < 10; attempt++) {
    const startBigram = pool[Math.floor(Math.random() * pool.length)]
    if (!startBigram) continue
    let bigram = startBigram
    let result = bigram

    let running = 50
    while (running && result.length < maxLen) {
      running--
      const possibleNext = map[bigram]
      if (!possibleNext) break

      const nextChar = possibleNext[Math.floor(Math.random() * possibleNext.length)]

      if (nextChar === null || nextChar === undefined) {
        if (result.length >= minLen) break
        continue
      }

      result += nextChar
      bigram = result.slice(-2)
    }

    if (running) return result.charAt(0).toUpperCase() + result.slice(1)
  }
  throw new Error('failed to generate name')
}

export function makeLocalPart(): string {
  const given = generate('given') + (Math.random() < 0.5 ? '' : `.${generate('given')}`)
  const surname = generate('surname') + (Math.random() < 0.5 ? '' : `-${generate('surname')}`)
  return `${given}.${surname}`.toLowerCase()
}
