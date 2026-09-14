import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, SubmitEvent } from 'react'
import { fetchCharacters } from './api/characters'
import type { Character } from './api/characters'
import './App.css'

type ColumnId = 'todo' | 'doing' | 'done'

type Item = {
  id: string
  title: string
  characterId: string
  characterName: string
  characterImage: string
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
const dragDataType = 'application/x-simple-kanban-item'

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
    const load = async () => {
      setLoadingCharacters(true)
      setCharacterError('')
      try {
        const results = await fetchCharacters(controller.signal)
        setCharacters(results)
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

    void load()

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
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

  const triggerCelebration = () => {
    setDoneBurst((value) => value + 1)
    setIsCelebrating(true)
    if (celebrationTimeoutRef.current !== null) {
      window.clearTimeout(celebrationTimeoutRef.current)
    }
    celebrationTimeoutRef.current = window.setTimeout(() => {
      setIsCelebrating(false)
    }, 700)
  }

  const moveItem = (
    payload: DragPayload,
    targetColumn: ColumnId,
    targetIndex: number,
  ) => {
    const shouldCelebrate = targetColumn === 'done' && payload.fromColumn !== 'done'

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
      if (shouldCelebrate) {
        queueMicrotask(triggerCelebration)
      }

      return next
    })
  }

  const handleDrop = (
    event: DragEvent<HTMLElement>,
    targetColumn: ColumnId,
    targetIndex: number,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    if (!event.dataTransfer.types.includes(dragDataType)) {
      return
    }

    try {
      const payload = JSON.parse(event.dataTransfer.getData(dragDataType)) as DragPayload
      moveItem(payload, targetColumn, targetIndex)
    } catch {
      // ignore invalid drag payloads
    }
  }

  const onCreateItem = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!newTitle.trim() || !selectedCharacterId) {
      return
    }

    const character = characterMap.get(selectedCharacterId)
    if (!character) {
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
          characterName: character.name,
          characterImage: character.image,
        },
      ],
    }))

    setNewTitle('')
    setSelectedCharacterId('')
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
                    onDragStart={(event) => {
                      const payload: DragPayload = {
                        fromColumn: column.id,
                        itemId: item.id,
                      }
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData(dragDataType, JSON.stringify(payload))
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, column.id, index)}
                  >
                    <strong>{item.title}</strong>
                    <span className="card-character">
                      <img
                        className="card-avatar"
                        src={item.characterImage}
                        alt={item.characterName}
                        loading="lazy"
                        width={28}
                        height={28}
                      />
                      {item.characterName}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          )
        })}

        <div className="confetti" aria-hidden>
          {Array.from({ length: 32 }).map((_, index) => (
            <span
              key={`burst-${doneBurst}-${index}`}
              className="confetti-piece"
              style={
                {
                  '--i': `${index}`,
                  '--delay': `${(index % 8) * 45}ms`,
                  '--duration': `${700 + (index % 5) * 120}ms`,
                  '--x': `${(index % 11) * 9 - 45}px`,
                } as CSSProperties
              }
            >
              {['🎉', '✨', '🎊', '🌟', '💫', '🎈', '🥳', '⭐'][index % 8]}
            </span>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
