export const map = (o, fn) => Object.keys(o).map(k => fn(k, o[k]))

export const asDataAttrs = (o) =>
  map(o, (k, v) => typeof v === 'boolean' ? (v ? k : '') : `${k}="${v}"`)
  .map(s => `data-${s}`)
  .join(' ')
