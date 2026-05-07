import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'

import cardsRouter from './routes/cards'
import vendorsRouter from './routes/vendors'
import tapRouter from './routes/tap'
import campaignsRouter from './routes/campaigns'
import mapRouter from './routes/map'
import authRouter from './routes/auth'
import aiRouter from './routes/ai'
import { errorHandler } from './middleware/errors'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    /\.vercel\.app$/,
    /\.up\.railway\.app$/,
    /\.onrender\.com$/
  ],
  credentials: true
}))

app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Night Market API is running.' })
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/cards', cardsRouter)
app.use('/api/vendors', vendorsRouter)
app.use('/api/tap', tapRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api', campaignsRouter)   // mounts /api/kiosk/tap
app.use('/api/map', mapRouter)
app.use('/api/ai', aiRouter)

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found.' })
})

// Centralised error handler
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Night Market API running on http://localhost:${PORT}`)
})

export default app
