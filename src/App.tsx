import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, FormEvent } from 'react'
import './App.css'

type ColumnId = 'todo' | 'doing' | 'done'

type Character = {
  id: string
  name: string
}

type Item = {
  id: string
  title: string
  characterId: string
  characterName: string
}

type DragPayload = {
  fromColumn: ColumnId
  itemId: string
}

const columns: Array<{ id: ColumnId; title: string }> = [
  { id: 'todo', title: 'To Do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
]

const initialItems: Record<ColumnId, Item[]> = {
  todo: [],
  doing: [],
  done: [],
}

function App() {
  const [itemsByColumn, setItemsByColumn] = useState<Record<ColumnId, Item[]>>(initialItems)
  const [characters, setCharacters] = useState<Character[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [loadingCharacters, setLoadingCharacters] = useState(false)
  const [characterError, setCharacterError] = useState('')
  const [doneBurst, setDoneBurst] = useState(0)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const celebrationTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchCharacters = async () => {
      setLoadingCharacters(true)
      setCharacterError('')
      try {
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
                  }
                }
              }
            `,
          }),
          signal: controller.signal,
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

        setCharacters(result.data?.characters?.results ?? [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setCharacterError('Could not load Rick and Morty characters.')
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCharacters(false)
        }
      }
    }

    void fetchCharacters()

    return () => controller.abort()
  }, [])

  useEffect(
    () => () => {
      if (celebrationTimeoutRef.current !== null) {
        window.clearTimeout(celebrationTimeoutRef.current)
      }
    },
    [],
  )

  const characterMap = useMemo(
    () => new Map(characters.map((character) => [character.id, character.name])),
    [characters],
  )

  const moveItem = (
    payload: DragPayload,
    targetColumn: ColumnId,
    targetIndex: number,
  ) => {
    setItemsByColumn((current) => {
      const sourceItems = [...current[payload.fromColumn]]
      const sourceIndex = sourceItems.findIndex((item) => item.id === payload.itemId)
      if (sourceIndex < 0) {
        return current
      }
      const movingItem = sourceItems[sourceIndex]

      sourceItems.splice(sourceIndex, 1)

      const next = {
        ...current,
        [payload.fromColumn]: sourceItems,
      }

      const isSameColumn = payload.fromColumn === targetColumn
      const adjustedIndex = isSameColumn && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
      const destinationItems = isSameColumn ? sourceItems : [...next[targetColumn]]

      destinationItems.splice(adjustedIndex, 0, movingItem)
      next[targetColumn] = destinationItems

      return next
    })

    if (targetColumn === 'done' && payload.fromColumn !== 'done') {
      setDoneBurst((value) => value + 1)
      setIsCelebrating(true)
      if (celebrationTimeoutRef.current !== null) {
        window.clearTimeout(celebrationTimeoutRef.current)
      }
      celebrationTimeoutRef.current = window.setTimeout(() => {
        setIsCelebrating(false)
      }, 500)
    }
  }

  const handleDrop = (
    event: DragEvent<HTMLElement>,
    targetColumn: ColumnId,
    targetIndex: number,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      const payload = JSON.parse(event.dataTransfer.getData('text/plain')) as DragPayload
      moveItem(payload, targetColumn, targetIndex)
    } catch {
      // ignore invalid drag payloads
    }
  }

  const onCreateItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!newTitle.trim() || !selectedCharacterId) {
      return
    }

    const characterName = characterMap.get(selectedCharacterId)
    if (!characterName) {
      return
    }

    setItemsByColumn((current) => ({
      ...current,
      todo: [
        ...current.todo,
        {
          id: crypto.randomUUID(),
          title: newTitle.trim(),
          characterId: selectedCharacterId,
          characterName,
        },
      ],
    }))

    setNewTitle('')
    setSelectedCharacterId('')
  }

  const moveByKeyboard = (columnId: ColumnId, index: number, key: string) => {
    const item = itemsByColumn[columnId][index]
    if (!item) {
      return
    }

    const payload: DragPayload = {
      fromColumn: columnId,
      itemId: item.id,
    }

    if (key === 'ArrowUp' && index > 0) {
      moveItem(payload, columnId, index - 1)
      return
    }

    if (key === 'ArrowDown' && index < itemsByColumn[columnId].length - 1) {
      moveItem(payload, columnId, index + 2)
      return
    }

    const columnIndex = columns.findIndex((column) => column.id === columnId)
    if (key === 'ArrowLeft' && columnIndex > 0) {
      const targetColumn = columns[columnIndex - 1].id
      const targetIndex = Math.min(index, itemsByColumn[targetColumn].length)
      moveItem(payload, targetColumn, targetIndex)
    }

    if (key === 'ArrowRight' && columnIndex < columns.length - 1) {
      const targetColumn = columns[columnIndex + 1].id
      const targetIndex = Math.min(index, itemsByColumn[targetColumn].length)
      moveItem(payload, targetColumn, targetIndex)
    }
  }

  return (
    <main className="app">
      <h1>Simple Kanban</h1>

      <form className="task-form" onSubmit={onCreateItem}>
        <label className="field">
          <span>Task title</span>
          <input
            type="text"
            placeholder="Task title"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Character</span>
          <select
            value={selectedCharacterId}
            onChange={(event) => setSelectedCharacterId(event.target.value)}
            required
            disabled={loadingCharacters}
          >
            <option value="">Assign a Rick & Morty character</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={loadingCharacters || characters.length === 0}>
          Add item
        </button>
      </form>

      {characterError ? <p className="error">{characterError}</p> : null}

      <section className={`board ${isCelebrating ? 'celebrate' : ''}`}>
        {columns.map((column) => {
          const items = itemsByColumn[column.id]

          return (
            <article
              key={column.id}
              className="column"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, column.id, items.length)}
            >
              <h2>{column.title}</h2>
              <div className="cards">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="card"
                    draggable
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                        return
                      }

                      event.preventDefault()
                      moveByKeyboard(column.id, index, event.key)
                    }}
                    onDragStart={(event) => {
                      const payload: DragPayload = {
                        fromColumn: column.id,
                        itemId: item.id,
                      }
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', JSON.stringify(payload))
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, column.id, index)}
                    aria-label={`Task ${item.title}. Use arrow keys to reorder or move columns.`}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.characterName}</span>
                  </div>
                ))}
              </div>
            </article>
          )
        })}

        <div className="confetti" aria-hidden>
          {Array.from({ length: 14 }).map((_, index) => (
            <span key={`burst-${doneBurst}-${index}`} style={{ '--i': `${index}` } as CSSProperties}>
              ✨
            </span>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
