import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	resolve: {
		alias: {
			'@2817/subscriptions': path.resolve(__dirname, '../subscriptions/index.ts'),
			'@2817/hash': path.resolve(__dirname, '../hash/src/index.ts'),
		},
	},
	test: {
		include: ['src/**/*.test.ts'],
	},
})
