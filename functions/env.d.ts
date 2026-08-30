/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database
  AI: Ai
  AI_MODEL: string
}
