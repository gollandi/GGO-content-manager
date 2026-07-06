export const BRAND_COLOR_SWATCHES = [
  { title: 'Primary Teal', value: '#00EEB6' },
  { title: 'Mint', value: '#B5FFE7' },
  { title: 'Soft Blue', value: '#E3EEFD' },
  { title: 'Clinical Blue', value: '#3208F5' },
  { title: 'Deep Indigo', value: '#140072' },
  { title: 'Forest Green', value: '#082C23' },
  { title: 'Charcoal', value: '#111111' },
  { title: 'Warm Charcoal', value: '#4B4B4B' },
] as const

export type BrandColorHex = (typeof BRAND_COLOR_SWATCHES)[number]['value']

export const DEFAULT_BRAND_COLOR: BrandColorHex = '#00EEB6'

export const BRAND_CLINICAL_BLUE: BrandColorHex =
  BRAND_COLOR_SWATCHES.find((color) => color.title === 'Clinical Blue')
    ?.value ?? DEFAULT_BRAND_COLOR
