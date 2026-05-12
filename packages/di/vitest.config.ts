import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	resolve: {
		alias: {
			'@2817/token': path.resolve(__dirname, '../token/src/index.ts'),
		},
	},
	test: {
		include: ['src/**/*.test.ts'],
	},
})
