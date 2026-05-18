import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'
import { runAgent } from '../agent/runner'

const router = Router()

const agentSchema = z.object({
  message: z.string().min(1).max(500),
  card_uid: z.string().min(4).max(20),
})

// POST /api/ai/agent
router.post('/agent', validate(agentSchema), async (req: Request, res: Response): Promise<void> => {
  const { message, card_uid } = req.body

  // Verify card exists before running the agent (defends against junk UIDs reaching Gemini)
  const { data: card } = await supabase
    .from('cards')
    .select('uid')
    .eq('uid', card_uid)
    .single()
  if (!card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }

  try {
    const reply = await runAgent(card_uid, message)
    res.json({ success: true, data: { reply } })
  } catch (err: any) {
    console.error('[AI] Agent error:', err)
    res.status(500).json({ success: false, error: 'AGENT_ERROR', message: err?.message ?? 'Agent failed.' })
  }
})

export default router
