import { OAuth2Client } from 'google-auth-library'

export interface GoogleUserPayload {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
  given_name?: string
  family_name?: string
  nonce?: string
}

/**
 * Verifies a Google ID token and extracts the user payload.
 *
 * @param idToken - The Google ID token (JWT) received from the client
 * @returns The verified user payload including the nonce, or null if verification fails
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUserPayload | null> {
  const config = useRuntimeConfig()
  const clientId = config.public.googleClientId

  if (!clientId) {
    console.error('Google Client ID not configured')
    return null
  }

  const client = new OAuth2Client(clientId)

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.email_verified) {
      return null
    }

    return {
      sub: payload.sub!,
      email: payload.email!,
      email_verified: payload.email_verified,
      name: payload.name || payload.email!.split('@')[0],
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
      // Include nonce from the token for server-side verification
      nonce: payload.nonce,
    }
  } catch (error) {
    console.error('Google token verification failed:', error)
    return null
  }
}
