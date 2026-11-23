import { Router } from 'express'

const router = Router()

// Abhi data memory mein hai (server restart pe reset ho jayega).
// EXERCISE: isko JSON file ya database (MongoDB/SQLite) mein save karo.
let todos = [
  { id: 1, title: 'React seekhna', done: false },
  { id: 2, title: 'Node.js API banana', done: true },
]
let nextId = 3

// GET /api/todos  -> sab todos
router.get('/', (req, res) => {
  res.json(todos)
})

// GET /api/todos/:id  -> ek todo
router.get('/:id', (req, res) => {
  const todo = todos.find((t) => t.id === Number(req.params.id))
  if (!todo) return res.status(404).json({ error: 'Todo nahi mila' })
  res.json(todo)
})

// POST /api/todos  -> naya todo
router.post('/', (req, res) => {
  const { title } = req.body
  if (!title) return res.status(400).json({ error: 'title zaroori hai' })
  const todo = { id: nextId++, title, done: false }
  todos.push(todo)
  res.status(201).json(todo)
})

// PUT /api/todos/:id  -> update
router.put('/:id', (req, res) => {
  const todo = todos.find((t) => t.id === Number(req.params.id))
  if (!todo) return res.status(404).json({ error: 'Todo nahi mila' })
  if (req.body.title !== undefined) todo.title = req.body.title
  if (req.body.done !== undefined) todo.done = req.body.done
  res.json(todo)
})

// DELETE /api/todos/:id
router.delete('/:id', (req, res) => {
  const before = todos.length
  todos = todos.filter((t) => t.id !== Number(req.params.id))
  if (todos.length === before) return res.status(404).json({ error: 'Todo nahi mila' })
  res.status(204).end()
})

export default router
