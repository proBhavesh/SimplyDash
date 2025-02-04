// pages/_app.tsx
import '../src/styles/globals.css'
import type { AppProps } from 'next/app'
import { initializeApp, getApps } from 'firebase/app'

// Import your Firebase configuration
import { firebaseConfig } from '../src/app/firebaseConfig'

if (!getApps().length) {
  initializeApp(firebaseConfig)
  console.log('🔥 Firebase has been initialized!')
}

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

export default MyApp