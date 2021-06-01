import fs from 'fs-extra'

const BIN_FILE = './bin/emitter'
const ENCODING: BufferEncoding = 'utf-8'
const SHEBANG = '#!/usr/bin/env node\n'

try {
	const buffer = fs.readFileSync(BIN_FILE, { encoding: ENCODING })
	const codeLines = buffer.toString().split('\n')
	for (const [index, codeLine] of codeLines.entries()) {
		const codeByWord = codeLine.split(' ')
		if ('import' === codeByWord[0]) {
			let dependencyName = '';
			let isDependencyName = false;
			for (const [wordIndex, word] of codeByWord.entries()) {
				const isAfterAllImport = codeByWord[wordIndex-1] === '*' || codeByWord[wordIndex-2] === '*'
				if (word === 'from') {
					isDependencyName = false
				}
				if (word === '*') {
					dependencyName = dependencyName.concat(codeByWord[wordIndex+2] + ' ')
				} else if (isDependencyName && !isAfterAllImport) {
					dependencyName = dependencyName.concat(word + ' ')
				}
				if (word === 'import') {
					isDependencyName = true
				}
			}
			const packageNameSq = codeLine.split("'")[1]
			const packageNameDq = codeLine.split('"')[1]
			const packageName = packageNameSq ? packageNameSq : packageNameDq
			codeLines[index] = `var ${ dependencyName }= require('${ packageName }');`
		}
	}
	const code = codeLines.join(
		`
`
	)
	const executableCode = SHEBANG.concat(code)
	fs.writeFileSync(BIN_FILE, executableCode, { encoding: ENCODING })
	fs.writeFileSync(BIN_FILE.concat('.cmd'), 'node %~dp0\\emitter', { encoding: ENCODING })
	fs.writeFileSync(BIN_FILE.concat('.sh'), 'node $(dirname "$0")/emitter', { encoding: ENCODING })
	fs.chmodSync(BIN_FILE, '0755')
	fs.chmodSync(BIN_FILE.concat('.sh'), '0755')
	fs.removeSync('./dist')
} catch (error) {
	console.error(error)
}
