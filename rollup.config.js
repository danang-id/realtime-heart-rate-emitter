import commonjs from 'rollup-plugin-commonjs';
import typescript from 'rollup-plugin-typescript';
import json from 'rollup-plugin-json';

export default {
	plugins: [
		typescript(),
		commonjs(),
		json()
	],
	input: 'lib/app.ts',
	output: {
		file: 'bin/emitter',
		format: 'esm'
	}
};
