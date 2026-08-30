// Passkey（WebAuthn）客户端封装
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { api } from './api'
import type { User } from './types'

export async function registerWithPasskey(username: string): Promise<User> {
  const { data: { challengeId, options } } = await api.registerOptions(username)
  const credential = await startRegistration(options)
  const res = await api.registerVerify({ challengeId, username, credential })
  return res.data.user
}

export async function loginWithPasskey(username: string): Promise<User> {
  const { data: { challengeId, options } } = await api.loginOptions(username)
  const credential = await startAuthentication(options)
  const res = await api.loginVerify({ challengeId, credential })
  return res.data.user
}
