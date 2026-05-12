let nextEntityId = 0
let nextWorldId = 0
let nextComponentId = 0

export const makeEntityId = () => `ent_${nextEntityId++}`
export const makeWorldId = () => `world_${nextWorldId++}`
export const makeComponentId = () => `comp_${nextComponentId++}`
