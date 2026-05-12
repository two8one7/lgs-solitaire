import type { IEntity } from './types'

export function isEntity(entity: unknown): entity is IEntity {
	return (
		typeof entity === 'object' &&
		entity !== null &&
		'id' in entity &&
		'index' in entity &&
		'getWorld' in entity &&
		typeof entity.getWorld === 'function'
	)
}

export function isEntityData(data: unknown): data is Omit<IEntity, 'getWorld'> {
	return (
		typeof data === 'object' &&
		data !== null &&
		'id' in data &&
		'index' in data &&
		'_type' in data &&
		data._type === 'entity'
	)
}
