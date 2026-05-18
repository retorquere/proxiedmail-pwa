import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const given = new Set()
const targetDir = 'names/given'
for (let txt of readdirSync(targetDir).filter(file => extname(file).toLowerCase() === '.txt')) {
  txt = join(targetDir, txt)

  for (const line of readFileSync(txt, 'utf-8').split('\n')) {
    given.add(line.trim().replace(/,.*/, '').toLowerCase())
  }
}

const surnames = new Set()
for (const line of readFileSync('names/surname/Names_2010Census.csv', 'utf-8').split('\n')) {
  surnames.add(line.trim().replace(/,.*/, '').toLowerCase())
}

const transitions = { given: {}, surname: {} }
const starts = { given: [], surname: [] }

function add(type, names) {
  for (const name of names) {
    if (name.length < 3) return // Need at least a bigram + 1 char

    // Record the starting sequence
    starts[type].push(name.substring(0, 2))

    for (let i = 0; i < name.length - 2; i++) {
      const bigram = name.substring(i, i + 2)
      const nextChar = name[i + 2]

      if (!transitions[type][bigram]) transitions[type][bigram] = []
      transitions[type][bigram].push(nextChar)
    }

    const end = name.slice(-2)
    if (!transitions[type][end]) transitions[type][end] = []
    transitions[type][end].push(null)
  }
}

add('given', [...given])
add('surname', [...surnames])
writeFileSync('src/utils/name_model.json', JSON.stringify({ transitions, starts }))
