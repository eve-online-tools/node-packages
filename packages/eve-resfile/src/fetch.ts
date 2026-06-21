export const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status}).`)
  }

  return response.text()
}

export const fetchBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status}).`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
