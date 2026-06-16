import { Request, Response, NextFunction } from 'express'

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(err)

  // Supabase / Postgres unique constraint violation
  if (err?.code === '23505') {
    res.status(409).json({
      success: false,
      error: 'DUPLICATE_ENTRY',
      message: 'A record with this value already exists.'
    })
    return
  }

  // Surface the underlying DB/runtime error so failures are diagnosable
  // (e.g. a missing column shows the real PostgREST message instead of a
  // generic one). Falls back to the generic message when nothing useful.
  const detail = err?.message || err?.details || err?.hint
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    code: err?.code,
    message: detail ? `An unexpected error occurred: ${detail}` : 'An unexpected error occurred'
  })
}
