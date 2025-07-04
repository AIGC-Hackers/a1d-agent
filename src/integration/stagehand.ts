import { Stagehand } from '@browserbasehq/stagehand'

export function createStagehandSession() {
  let stagehand: Stagehand | null = null
  let initialized = false
  let lastUsed = Date.now()
  const sessionTimeout = 10 * 60 * 1000 // 10 minutes

  let cleanupTimer: NodeJS.Timeout | null = null

  // Start cleanup timer
  cleanupTimer = setInterval(async () => {
    if (!stagehand || !initialized) return

    const now = Date.now()
    if (now - lastUsed > sessionTimeout) {
      console.log('Cleaning up idle Stagehand session')
      try {
        await stagehand.close()
      } catch (error) {
        console.error(`Error closing idle session: ${error}`)
      }
      stagehand = null
      initialized = false
    }
  }, 60 * 1000)

  const get = async (): Promise<Stagehand> => {
    lastUsed = Date.now()

    try {
      // Initialize if not already initialized
      if (!stagehand || !initialized) {
        console.log('Creating new Stagehand instance')
        stagehand = new Stagehand({
          apiKey: process.env.BROWSERBASE_API_KEY!,
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          env: 'BROWSERBASE',
        })

        try {
          console.log('Initializing Stagehand...')
          await stagehand.init()
          console.log('Stagehand initialized successfully')
          initialized = true
          return stagehand
        } catch (initError) {
          console.error('Failed to initialize Stagehand:', initError)
          throw initError
        }
      }

      try {
        const title = await stagehand.page.evaluate(() => document.title)
        console.log('Session check successful, page title:', title)
        return stagehand
      } catch (error) {
        // If we get an error indicating the session is invalid, reinitialize
        console.error('Session check failed:', error)
        if (
          error instanceof Error &&
          (error.message.includes(
            'Target page, context or browser has been closed',
          ) ||
            error.message.includes('Session expired') ||
            error.message.includes('context destroyed'))
        ) {
          console.log('Browser session expired, reinitializing Stagehand...')
          stagehand = new Stagehand({
            apiKey: process.env.BROWSERBASE_API_KEY!,
            projectId: process.env.BROWSERBASE_PROJECT_ID!,
            env: 'BROWSERBASE',
          })
          await stagehand.init()
          initialized = true
          return stagehand
        }
        throw error // Re-throw if it's a different type of error
      }
    } catch (error) {
      initialized = false
      stagehand = null
      const errorMsg = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Failed to initialize/reinitialize Stagehand: ${errorMsg}`,
      )
    }
  }

  const dispose = async (): Promise<void> => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = null
    }

    if (stagehand) {
      try {
        await stagehand.close()
      } catch (error) {
        console.error(`Error closing Stagehand session: ${error}`)
      }
      stagehand = null
      initialized = false
    }
  }

  return { get, dispose }
}

// Create a singleton session
export const stagehandSession = createStagehandSession()
