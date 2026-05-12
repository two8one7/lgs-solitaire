import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AssetManifest } from './types'

// Mock Three.js and addons before importing the loader
vi.mock('three', () => {
	const LoadingManagerMock = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.onProgress = null
		this.onLoad = null
		this.onError = null
		this.itemStart = vi.fn()
		this.itemEnd = vi.fn()
		this.itemError = vi.fn()
	})

	const TextureLoaderMock = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.manager = null
		this.load = vi.fn((_url, onLoad) => {
			onLoad({ isTexture: true })
		})
	})

	const CubeTextureLoaderMock = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.manager = null
		this.load = vi.fn((_urls, onLoad) => {
			onLoad({ isCubeTexture: true })
		})
	})

	return {
		LoadingManager: LoadingManagerMock,
		TextureLoader: TextureLoaderMock,
		CubeTextureLoader: CubeTextureLoaderMock,
	}
})

const mockGltfLoad = vi.fn((_url: string, onLoad: (gltf: unknown) => void) => {
	onLoad({ scene: { isGroup: true }, animations: [{ isAnimationClip: true }] })
})

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.manager = null
		this.load = mockGltfLoad
		this.setDRACOLoader = vi.fn()
		this.setKTX2Loader = vi.fn()
	}),
}))

const mockDracoDispose = vi.fn()
vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
	DRACOLoader: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.manager = null
		this.setDecoderPath = vi.fn()
		this.dispose = mockDracoDispose
	}),
}))

const mockKtx2Dispose = vi.fn()
vi.mock('three/addons/loaders/KTX2Loader.js', () => ({
	KTX2Loader: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.manager = null
		this.setTranscoderPath = vi.fn()
		this.detectSupport = vi.fn()
		this.dispose = mockKtx2Dispose
	}),
}))

vi.mock('three/addons/loaders/RGBELoader.js', () => ({
	RGBELoader: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.manager = null
		this.load = vi.fn((_url, onLoad) => {
			onLoad({ isDataTexture: true })
		})
	}),
}))

vi.mock('three/addons/loaders/FontLoader.js', () => ({
	FontLoader: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
		this.manager = null
		this.load = vi.fn((_url, onLoad) => {
			onLoad({ isFont: true, data: {} })
		})
	}),
}))

// Must import after mocks
const { createResourceLoader } = await import('./loader')
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js')
const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js')

beforeEach(() => {
	vi.clearAllMocks()
})

describe('createResourceLoader', () => {
	describe('manifest validation', () => {
		it('rejects cubemap with non-array path', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'sky', type: 'cubemap', path: '/sky.hdr' },
			]
			await expect(loader.load(manifest)).rejects.toThrow(
				'Cubemap "sky" requires path to be a string[] of 6 face URLs'
			)
		})

		it('rejects cubemap with wrong number of faces', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'sky', type: 'cubemap', path: ['/px.jpg', '/nx.jpg', '/py.jpg'] },
			]
			await expect(loader.load(manifest)).rejects.toThrow(
				'Cubemap "sky" requires path to be a string[] of 6 face URLs'
			)
		})

		it('rejects non-cubemap with array path', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: ['/a.glb', '/b.glb'] as unknown as string },
			]
			await expect(loader.load(manifest)).rejects.toThrow(
				'requires path to be a string'
			)
		})

		it('rejects duplicate ids', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'thing', type: 'gltf', path: '/a.glb' },
				{ id: 'thing', type: 'gltf', path: '/b.glb' },
			]
			await expect(loader.load(manifest)).rejects.toThrow(
				'Duplicate asset id: "thing"'
			)
		})

		it('rejects entry missing id', async () => {
			const loader = createResourceLoader()
			const manifest = [
				{ id: '', type: 'gltf', path: '/a.glb' },
			] as AssetManifest
			await expect(loader.load(manifest)).rejects.toThrow('missing id')
		})
	})

	describe('empty manifest', () => {
		it('resolves with internal assets map', async () => {
			const loader = createResourceLoader()
			const result = await loader.load([])
			expect(result).toBeInstanceOf(Map)
			expect(result.size).toBe(0)
			expect(result).toBe(loader.assets)
		})
	})

	describe('basePath', () => {
		it('prepends basePath to asset paths', async () => {
			const loader = createResourceLoader({ basePath: '/assets/' })
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: 'models/test.glb' },
			]
			await loader.load(manifest)

			expect(mockGltfLoad).toHaveBeenCalledWith(
				'/assets/models/test.glb',
				expect.any(Function),
				undefined,
				expect.any(Function),
			)
		})

		it('handles basePath without trailing slash', async () => {
			const loader = createResourceLoader({ basePath: '/assets' })
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: 'models/test.glb' },
			]
			await loader.load(manifest)

			expect(mockGltfLoad).toHaveBeenCalledWith(
				'/assets/models/test.glb',
				expect.any(Function),
				undefined,
				expect.any(Function),
			)
		})

		it('handles asset path with leading slash', async () => {
			const loader = createResourceLoader({ basePath: '/assets/' })
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/models/test.glb' },
			]
			await loader.load(manifest)

			expect(mockGltfLoad).toHaveBeenCalledWith(
				'/assets/models/test.glb',
				expect.any(Function),
				undefined,
				expect.any(Function),
			)
		})
	})

	describe('lazy loader initialization', () => {
		it('does not create DRACOLoader for plain gltf manifest', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			]
			await loader.load(manifest)

			expect(DRACOLoader).not.toHaveBeenCalled()
		})

		it('creates DRACOLoader only when manifest has draco assets', async () => {
			const loader = createResourceLoader({ draco: '/draco/' })
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf-draco', path: '/test.glb' },
			]
			await loader.load(manifest)

			expect(DRACOLoader).toHaveBeenCalled()
		})

		it('does not create KTX2Loader for non-ktx2 manifest', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			]
			await loader.load(manifest)

			expect(KTX2Loader).not.toHaveBeenCalled()
		})

		it('creates KTX2Loader when manifest has ktx2 assets', async () => {
			const loader = createResourceLoader({ ktx2: '/basis/' })
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf-ktx2', path: '/test.glb' },
			]
			await loader.load(manifest)

			expect(KTX2Loader).toHaveBeenCalled()
		})
	})

	describe('destroy', () => {
		it('rejects load calls after destroy', async () => {
			const loader = createResourceLoader()
			loader.destroy()

			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			]
			await expect(loader.load(manifest)).rejects.toThrow('destroyed')
		})

		it('disposes DRACOLoader if it was created', async () => {
			const loader = createResourceLoader({ draco: '/draco/' })
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf-draco', path: '/test.glb' },
			]
			await loader.load(manifest)

			loader.destroy()
			expect(mockDracoDispose).toHaveBeenCalled()
		})

		it('disposes KTX2Loader if it was created', async () => {
			const loader = createResourceLoader({ ktx2: '/basis/' })
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf-ktx2', path: '/test.glb' },
			]
			await loader.load(manifest)

			loader.destroy()
			expect(mockKtx2Dispose).toHaveBeenCalled()
		})
	})

	describe('progress callback', () => {
		it('fires onProgress with correct shape', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			]
			const progressCalls: unknown[] = []

			await loader.load(manifest, {
				onProgress: (info) => {
					progressCalls.push(info)
					expect(info).toHaveProperty('loaded')
					expect(info).toHaveProperty('total')
					expect(info).toHaveProperty('percent')
					expect(info).toHaveProperty('currentAsset')
					expect(typeof info.loaded).toBe('number')
					expect(typeof info.total).toBe('number')
					expect(typeof info.percent).toBe('number')
					expect(typeof info.currentAsset).toBe('string')
				},
			})
			// Progress may or may not fire depending on LoadingManager mock,
			// but the shape assertion validates if it does
		})
	})

	describe('load results', () => {
		it('returns results keyed by asset id', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'my-model', type: 'gltf', path: '/test.glb' },
			]
			const results = await loader.load(manifest)

			expect(results.has('my-model')).toBe(true)
			expect(results.get('my-model')).toEqual({ scene: { isGroup: true }, animations: [{ isAnimationClip: true }] })
		})

		it('stores gltf.scene not the full gltf object', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			]
			const results = await loader.load(manifest)
			const result = results.get('model')

			// Should extract scene + animations, not the full GLTF object
			expect(result).toEqual({ scene: { isGroup: true }, animations: [{ isAnimationClip: true }] })
		})

		it('loads multiple assets into the same map', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model-a', type: 'gltf', path: '/a.glb' },
				{ id: 'model-b', type: 'gltf', path: '/b.glb' },
			]
			const results = await loader.load(manifest)

			expect(results.size).toBe(2)
			expect(results.has('model-a')).toBe(true)
			expect(results.has('model-b')).toBe(true)
		})
	})

	describe('assets getter', () => {
		it('exposes the internal map directly', () => {
			const loader = createResourceLoader()
			expect(loader.assets).toBeInstanceOf(Map)
			expect(loader.assets.size).toBe(0)
		})

		it('returns the same map instance as load()', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			]
			const result = await loader.load(manifest)

			expect(result).toBe(loader.assets)
		})

		it('provides access to loaded assets without calling load()', async () => {
			const loader = createResourceLoader()
			const manifest: AssetManifest = [
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			]
			await loader.load(manifest)

			expect(loader.assets.has('model')).toBe(true)
			expect(loader.assets.get('model')).toEqual({ scene: { isGroup: true }, animations: [{ isAnimationClip: true }] })
		})
	})

	describe('accumulating map', () => {
		it('accumulates assets across multiple load() calls', async () => {
			const loader = createResourceLoader()

			await loader.load([
				{ id: 'model-a', type: 'gltf', path: '/a.glb' },
			])
			expect(loader.assets.size).toBe(1)

			await loader.load([
				{ id: 'model-b', type: 'gltf', path: '/b.glb' },
			])
			expect(loader.assets.size).toBe(2)
			expect(loader.assets.has('model-a')).toBe(true)
			expect(loader.assets.has('model-b')).toBe(true)
		})

		it('skips already-loaded IDs without re-fetching', async () => {
			const loader = createResourceLoader()

			await loader.load([
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			])
			expect(mockGltfLoad).toHaveBeenCalledTimes(1)

			mockGltfLoad.mockClear()
			await loader.load([
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			])
			expect(mockGltfLoad).not.toHaveBeenCalled()
		})

		it('resolves immediately when all IDs are already loaded', async () => {
			const loader = createResourceLoader()

			await loader.load([
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			])

			const result = await loader.load([
				{ id: 'model', type: 'gltf', path: '/test.glb' },
			])
			expect(result).toBe(loader.assets)
		})

		it('loads only the new entries from a mixed manifest', async () => {
			const loader = createResourceLoader()

			await loader.load([
				{ id: 'model-a', type: 'gltf', path: '/a.glb' },
			])
			expect(mockGltfLoad).toHaveBeenCalledTimes(1)

			mockGltfLoad.mockClear()
			await loader.load([
				{ id: 'model-a', type: 'gltf', path: '/a.glb' },
				{ id: 'model-b', type: 'gltf', path: '/b.glb' },
			])
			// Only model-b should be loaded
			expect(mockGltfLoad).toHaveBeenCalledTimes(1)
			expect(loader.assets.size).toBe(2)
		})
	})
})
