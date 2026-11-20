export const toCamelCase = (name: string): string => {
  const words = name
    .replace(/'/g, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)

  if (words.length === 0) {
    throw new Error('Cannot convert empty string to camelCase')
  }

  const [first, ...rest] = words

  return (
    first.charAt(0).toLowerCase() +
    first.slice(1).toLowerCase() +
    rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('')
  )
}

export const toKebabCase = (name: string): string => {
  const withBoundaries = name.replace(/'/g, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')

  const words = withBoundaries.split(/[^a-zA-Z0-9]+/).filter(Boolean)

  if (words.length === 0) {
    throw new Error('Cannot convert empty string to kebab-case')
  }

  return words.map((word) => word.toLowerCase()).join('-')
}
