export type Character = {
  id: string
  name: string
  image: string
}

export async function fetchCharacters(signal?: AbortSignal): Promise<Character[]> {
  const response = await fetch('https://rickandmortyapi.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query Characters {
          characters(page: 1) {
            results {
              id
              name
              image
            }
          }
        }
      `,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to load characters')
  }

  const result: {
    data?: { characters?: { results?: Character[] } }
    errors?: Array<{ message: string }>
  } = await response.json()

  if (result.errors?.length) {
    throw new Error(result.errors[0].message)
  }

  return result.data?.characters?.results ?? []
}
