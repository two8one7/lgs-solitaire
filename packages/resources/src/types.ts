import type * as THREE from 'three'

export type GltfAsset = {
	scene: THREE.Group
	animations: THREE.AnimationClip[]
}

export type AssetType =
	| 'gltf'
	| 'gltf-draco'
	| 'gltf-ktx2'
	| 'gltf-draco-ktx2'
	| 'gltf-meshopt'
	| 'texture'
	| 'hdr'
	| 'cubemap'
	| 'audio'
	| 'font'
	| 'image'

// Optional color-space hint for texture-like entries. 'srgb' is for
// albedo/diffuse maps that were authored in sRGB (the default for
// Three's TextureLoader already). 'linear' is for data textures —
// normal maps, roughness/metalness packs, masks, emission glow maps —
// where sampling must not apply gamma decoding.
export type AssetColorSpace = 'srgb' | 'linear'

export type AssetEntry = {
	id: string
	type: AssetType
	path: string | string[]
	// Defaults to 'srgb' for texture/hdr/cubemap. Ignored by non-texture
	// asset types.
	colorSpace?: AssetColorSpace
}

export type AssetManifest = AssetEntry[]

export type LoaderConfig = {
	basePath?: string
	draco?: string
	ktx2?: string
	renderer?: THREE.WebGLRenderer
}

export type ProgressInfo = {
	loaded: number
	total: number
	percent: number
	currentAsset: string
}

export type LoadOptions = {
	onProgress?: (info: ProgressInfo) => void
}

export interface IResourceLoader {
	load(manifest: AssetManifest, options?: LoadOptions): Promise<ResourceMap>
	readonly assets: ResourceMap
	destroy(): void
}

export type ResourceMap = Map<string, unknown>
