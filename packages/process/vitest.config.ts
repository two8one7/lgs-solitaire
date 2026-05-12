import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	test: {
		globals: true,
	},
	resolve: {
		alias: {
			'@2817/subscriptions': path.resolve(__dirname, '../subscriptions/index.ts'),
		},
	},
})
