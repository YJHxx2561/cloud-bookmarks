// Passkey（WebAuthn）客户端封装
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { api } from './api'
import type { User } from './types'

// 仅通行密钥登录（未设置密码的用户）
export async function loginWithPasskey(username: string): Promise<User> {
  const { data: { challengeId, options } } = await api.loginOptions(username)
  const credential = await startAuthentication(options)
  const res = await api.loginVerify({ challengeId, credential })
  return res.data.user
}

// 使用已有 options 完成注册（密码+通行密钥 / 仅通行密钥）
export async function registerWithOptions(
  options: any,
  username: string,
  challengeId: string
): Promise<User> {
  const credential = await startRegistration(options)
  const res = await api.registerVerify({ challengeId, username, credential })
  return res.data.user
}

// 使用已有 options 完成认证（2FA 第二步 / 仅通行密钥登录）
export async function authenticateWithOptions(options: any, challengeId: string): Promise<User> {
  const credential = await startAuthentication(options)
  const res = await api.loginVerify({ challengeId, credential })
  return res.data.user
}

// 账户设置：添加通行密钥
export async function addAccountPasskey(): Promise<void> {
  const { data: { challengeId, options } } = await api.addPasskeyOptions()
  const credential = await startRegistration(options)
  await api.addPasskeyVerify(challengeId, credential)
}
