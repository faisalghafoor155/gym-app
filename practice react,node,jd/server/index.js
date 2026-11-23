import express from 'express'
import cors from 'cors'
import todosRouter from './routes/todos.js'

const app = express()
const PORT = process.env.PORT || 5050

// Middleware
app.use(cors())
app.use(express.json())

// Simple logger middleware (practice ke liye)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Node server!' })
})

app.use('/api/todos', todosRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.listen(PORT, () => {
  console.log(`Server chal raha hai: http://localhost:${PORT}`)
})
