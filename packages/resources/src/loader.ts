import {
	TextureLoader,
	CubeTextureLoader,
	LoadingManager,
	LinearSRGBColorSpace,
	SRGBColorSpace,
	type ColorSpace,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import type {
	AssetEntry,
	AssetManifest,
	IResourceLoader,
	LoaderConfig,
	LoadOptions,
	ProgressInfo,
	ResourceMap,
} from './types'

type AssetTypeCategory =
	| 'gltf'
	| 'draco'
	| 'ktx2'
	| 'meshopt'
	| 'texture'
	| 'hdr'
	| 'cubemap'
	| 'font'

function needsDraco(type: string): boolean {
	return type === 'gltf-draco' || type === 'gltf-draco-ktx2'
}

function needsKtx2(type: string): boolean {
	return type === 'gltf-ktx2' || type === 'gltf-draco-ktx2'
}

function needsMeshopt(type: string): boolean {
	return type === 'gltf-meshopt'
}

function isGltfType(type: string): boolean {
	return (
		type === 'gltf' ||
		type === 'gltf-draco' ||
		type === 'gltf-ktx2' ||
		type === 'gltf-draco-ktx2' ||
		type === 'gltf-meshopt'
	)
}

function getNeededLoaderTypes(manifest: AssetManifest): Set<AssetTypeCategory> {
	const needed = new Set<AssetTypeCategory>()
	for (const entry of manifest) {
		if (isGltfType(entry.type)) {
			needed.add('gltf')
		}

		if (needsDraco(entry.type)) {
			needed.add('draco')
		}

		if (needsKtx2(entry.type)) {
			needed.add('ktx2')
		}

		if (needsMeshopt(entry.type)) {
			needed.add('meshopt')
		}

		if (entry.type === 'texture') {
			needed.add('texture')
		}

		if (entry.type === 'hdr') {
			needed.add('hdr')
		}

		if (entry.type === 'cubemap') {
			needed.add('cubemap')
		}

		if (entry.type === 'font') {
			needed.add('font')
		}
	}
	return needed
}

function resolvePath(basePath: string, assetPath: string): string {
	if (!basePath) return assetPath
	const base = basePath.endsWith('/') ? basePath : basePath + '/'
	const asset = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
	return base + asset
}

function resolveColorSpace(cs: 'srgb' | 'linear' | undefined): ColorSpace {
	// Default: 'srgb'. Matches the common case (diffuse/albedo) and
	// Three's default for TextureLoader. Normal maps, masks, emission
	// glow maps, roughness/metalness packs, and other data textures
	// must set 'linear' explicitly in the manifest.
	return cs === 'linear' ? LinearSRGBColorSpace : SRGBColorSpace
}

function validateManifest(manifest: AssetManifest): string | null {
	const ids = new Set<string>()
	for (const entry of manifest) {
		if (!entry.id) return 'Asset entry missing id'
		if (!entry.type) return `Asset "${entry.id}" missing type`
		if (!entry.path) return `Asset "${entry.id}" missing path`
		if (ids.has(entry.id)) return `Duplicate asset id: "${entry.id}"`
		ids.add(entry.id)

		if (entry.type === 'cubemap') {
			if (!Array.isArray(entry.path) || entry.path.length !== 6) {
				return `Cubemap "${entry.id}" requires path to be a string[] of 6 face URLs`
			}
		} else {
			if (typeof entry.path !== 'string') {
				return `Asset "${entry.id}" (type "${entry.type}") requires path to be a string`
			}
		}
	}
	return null
}

export function createResourceLoader(
	config: LoaderConfig = {}
): IResourceLoader {
	const { basePath = '', draco, ktx2, renderer } = config

	// Single internal map that accumulates across load() calls
	const assets: ResourceMap = new Map()

	// Lazy-initialized loaders (reused across load() calls)
	let gltfLoader: GLTFLoader | null = null
	let dracoLoader: DRACOLoader | null = null
	let ktx2Loader: KTX2Loader | null = null
	let textureLoader: TextureLoader | null = null
	let rgbeLoader: RGBELoader | null = null
	let cubeTextureLoader: CubeTextureLoader | null = null
	let fontLoader: FontLoader | null = null

	let destroyed = false

	function ensureGltfLoader(manager: LoadingManager): GLTFLoader {
		if (!gltfLoader) gltfLoader = new GLTFLoader(manager)
		else gltfLoader.manager = manager
		return gltfLoader
	}

	function ensureDracoLoader(manager: LoadingManager): DRACOLoader {
		if (!dracoLoader) {
			dracoLoader = new DRACOLoader(manager)
			if (draco) dracoLoader.setDecoderPath(draco)
		} else {
			dracoLoader.manager = manager
		}
		return dracoLoader
	}

	function ensureKtx2Loader(manager: LoadingManager): KTX2Loader {
		if (!ktx2Loader) {
			ktx2Loader = new KTX2Loader(manager)
			if (ktx2) ktx2Loader.setTranscoderPath(ktx2)
			if (renderer) ktx2Loader.detectSupport(renderer)
		} else {
			ktx2Loader.manager = manager
		}
		return ktx2Loader
	}

	function ensureTextureLoader(manager: LoadingManager): TextureLoader {
		if (!textureLoader) textureLoader = new TextureLoader(manager)
		else textureLoader.manager = manager
		return textureLoader
	}

	function ensureRgbeLoader(manager: LoadingManager): RGBELoader {
		if (!rgbeLoader) rgbeLoader = new RGBELoader(manager)
		else rgbeLoader.manager = manager
		return rgbeLoader
	}

	function ensureCubeTextureLoader(
		manager: LoadingManager
	): CubeTextureLoader {
		if (!cubeTextureLoader)
			cubeTextureLoader = new CubeTextureLoader(manager)
		else cubeTextureLoader.manager = manager
		return cubeTextureLoader
	}

	function ensureFontLoader(manager: LoadingManager): FontLoader {
		if (!fontLoader) fontLoader = new FontLoader(manager)
		else fontLoader.manager = manager
		return fontLoader
	}

	function loadEntry(
		entry: AssetEntry,
		manager: LoadingManager,
		needed: Set<AssetTypeCategory>
	): Promise<unknown> {
		const path =
			typeof entry.path === 'string'
				? resolvePath(basePath, entry.path)
				: entry.path

		switch (entry.type) {
			case 'gltf':
			case 'gltf-draco':
			case 'gltf-ktx2':
			case 'gltf-draco-ktx2':
			case 'gltf-meshopt': {
				const loader = ensureGltfLoader(manager)
				if (needsDraco(entry.type) && needed.has('draco')) {
					loader.setDRACOLoader(ensureDracoLoader(manager))
				}
				if (needsKtx2(entry.type) && needed.has('ktx2')) {
					loader.setKTX2Loader(ensureKtx2Loader(manager))
				}
				if (needsMeshopt(entry.type) && needed.has('meshopt')) {
					loader.setMeshoptDecoder(MeshoptDecoder)
				}
				return new Promise((resolve, reject) => {
					loader.load(
						path as string,
						(gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
						undefined,
						(err) => reject(err)
					)
				})
			}

			case 'texture': {
				const loader = ensureTextureLoader(manager)
				const cs = resolveColorSpace(entry.colorSpace)
				return new Promise((resolve, reject) => {
					loader.load(
						path as string,
						(texture) => {
							texture.colorSpace = cs
							resolve(texture)
						},
						undefined,
						(err) => reject(err)
					)
				})
			}

			case 'hdr': {
				const loader = ensureRgbeLoader(manager)
				const cs = resolveColorSpace(entry.colorSpace)
				return new Promise((resolve, reject) => {
					loader.load(
						path as string,
						(texture) => {
							texture.colorSpace = cs
							resolve(texture)
						},
						undefined,
						(err) => reject(err)
					)
				})
			}

			case 'cubemap': {
				const loader = ensureCubeTextureLoader(manager)
				const paths = (entry.path as string[]).map((p) =>
					resolvePath(basePath, p)
				)
				const cs = resolveColorSpace(entry.colorSpace)
				return new Promise((resolve, reject) => {
					loader.load(
						paths,
						(texture) => {
							texture.colorSpace = cs
							resolve(texture)
						},
						undefined,
						(err) => reject(err)
					)
				})
			}

			case 'audio': {
				// Returns raw ArrayBuffer — caller wraps in Howl via addBuffer or decodes manually
				const url = path as string
				manager.itemStart(url)
				return fetch(url)
					.then((res) => {
						if (!res.ok)
							throw new Error(
								`Failed to fetch audio "${entry.id}": ${res.status}`
							)
						return res.arrayBuffer()
					})
					.then((buffer) => {
						manager.itemEnd(url)
						return buffer
					})
					.catch((err) => {
						manager.itemError(url)
						manager.itemEnd(url)
						throw err
					})
			}

			case 'font': {
				const loader = ensureFontLoader(manager)
				return new Promise((resolve, reject) => {
					loader.load(
						path as string,
						(font) => resolve(font),
						undefined,
						(err) => reject(err)
					)
				})
			}

			case 'image': {
				const url = path as string
				manager.itemStart(url)
				return new Promise<HTMLImageElement>((resolve, reject) => {
					const img = new Image()
					img.onload = () => {
						manager.itemEnd(url)
						resolve(img)
					}
					img.onerror = (err) => {
						manager.itemError(url)
						manager.itemEnd(url)
						reject(err)
					}
					img.src = url
				})
			}

			default:
				return Promise.reject(
					new Error(`Unknown asset type: "${entry.type}"`)
				)
		}
	}

	function load(
		manifest: AssetManifest,
		options: LoadOptions = {}
	): Promise<ResourceMap> {
		if (destroyed) {
			return Promise.reject(
				new Error('ResourceLoader has been destroyed')
			)
		}

		if (manifest.length === 0) {
			return Promise.resolve(assets)
		}

		// Filter out entries already in the internal map
		const pending = manifest.filter((entry) => !assets.has(entry.id))

		if (pending.length === 0) {
			return Promise.resolve(assets)
		}

		const validationError = validateManifest(pending)
		if (validationError) {
			return Promise.reject(new Error(validationError))
		}

		const { onProgress } = options

		return new Promise<ResourceMap>((resolve, reject) => {
			let currentAsset = pending[0].id
			let hasErrored = false

			// Fresh manager per load() call for independent progress tracking
			const manager = new LoadingManager()

			manager.onProgress = (_url, loaded, total) => {
				if (onProgress) {
					const percent = total > 0 ? (loaded / total) * 100 : 0
					onProgress({
						loaded,
						total,
						percent,
						currentAsset,
					})
				}
			}

			manager.onError = (url) => {
				if (!hasErrored) {
					hasErrored = true
					reject(new Error(`Failed to load: ${url}`))
				}
			}

			const needed = getNeededLoaderTypes(pending)

			const promises = pending.map((entry) => {
				currentAsset = entry.id
				return loadEntry(entry, manager, needed)
					.then((result) => {
						assets.set(entry.id, result)
					})
					.catch((err) => {
						if (!hasErrored) {
							hasErrored = true
							const message =
								err instanceof Error ? err.message : String(err)
							reject(
								new Error(
									`Failed to load "${entry.id}": ${message}`
								)
							)
						}
					})
			})

			Promise.all(promises).then(() => {
				if (!hasErrored) {
					resolve(assets)
				}
			})
		})
	}

	function destroy() {
		destroyed = true
		if (dracoLoader) {
			dracoLoader.dispose()
			dracoLoader = null
		}
		if (ktx2Loader) {
			ktx2Loader.dispose()
			ktx2Loader = null
		}
		gltfLoader = null
		textureLoader = null
		rgbeLoader = null
		cubeTextureLoader = null
		fontLoader = null
	}

	return {
		load,
		get assets() {
			return assets
		},
		destroy,
	}
}
