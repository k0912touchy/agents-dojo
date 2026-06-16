import type { Agent } from './dojo'

const KEY = 'dojo_v2_agent'

export function loadAgent(): Agent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Agent) : null
  } catch {
    return null
  }
}

export function saveAgent(agent: Agent): void {
  localStorage.setItem(KEY, JSON.stringify(agent))
}

export function deleteAgent(): void {
  localStorage.removeItem(KEY)
}

export function createNewAgent(name: string, persona: import('./dojo').Persona): Agent {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    persona,
    knowledge: [],
    experiences: [],
  }
}
