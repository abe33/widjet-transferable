export const map = (o, fn) => Object.keys(o).map(k => fn(k, o[k]))

export const asDataAttrs = (o) => map(o, (k, v) => `data-${k}="${v}"`).join(' ')
