/**
 * Pack loader stub — Phase 2 scaffold.
 * 
 * Real pack content lands in Phase 4/7. For now, return a hardcoded stub.
 */

export interface ContentPack {
	slug: string
	region: string
	displayName: string
}

export function loadPack(): ContentPack {
	const slug = import.meta.env.PUBLIC_LGS_PACK || 'lakenona'
	
	// Hardcoded stub — extended in Phase 4
	return {
		slug,
		region: 'lakenona',
		displayName: 'Lake Nona',
	}
}
