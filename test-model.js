import { readFileSync } from 'fs';

const { transitions, starts } = JSON.parse(readFileSync('src/utils/name_model.json', 'utf-8'))

function generate(type, minLen = 5, maxLen = 9) {
  const pool = starts[type]
  const map = transitions[type]

	for (const attempt of Array.from({ length: 10 })) {
  	let bigram = pool[Math.floor(Math.random() * pool.length)];
  	let result = bigram;

		let running = 50
  	while (running && result.length < maxLen) {
			running--
    	const possibleNext = map[bigram];
    	if (!possibleNext) break;

    	const nextChar = possibleNext[Math.floor(Math.random() * possibleNext.length)];

    	if (nextChar === null) {
      	if (result.length >= minLen) break;
      	continue;
    	}

    	result += nextChar;
    	bigram = result.slice(-2);
  	}

  	if (running) return result.charAt(0).toUpperCase() + result.slice(1);
	}
	throw new Error('failed to generate name')
}

const given = generate('given') + (Math.random() < 0.5 ? '' : `.${generate('given')}`)
const surname = generate('surname') + (Math.random() < 0.5 ? '' : `-${generate('surname')}`)
console.log(`${given}.${surname}`)
