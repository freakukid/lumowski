const PENDING_INVITE_KEY = 'pendingInviteCode'

export const useInviteCode = () => {
  const storeInviteCode = (code: string) => {
    if (import.meta.client) {
      localStorage.setItem(PENDING_INVITE_KEY, code)
    }
  }

  const consumePendingInviteCode = (): string | null => {
    if (import.meta.client) {
      const code = localStorage.getItem(PENDING_INVITE_KEY)
      if (code) {
        localStorage.removeItem(PENDING_INVITE_KEY)
        return code
      }
    }
    return null
  }

  const clearStoredInviteCode = () => {
    if (import.meta.client) {
      localStorage.removeItem(PENDING_INVITE_KEY)
    }
  }

  return { storeInviteCode, consumePendingInviteCode, clearStoredInviteCode }
}
