// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
import './index.css'
import { configureApiClient } from '@/utils/apiClient'
import { useAuthStore, subscribeAuthStorage } from '@/store/authStore'

configureApiClient({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => useAuthStore.getState().logout(),
})

// Keep tabs in sync when accounts are added/removed elsewhere.
subscribeAuthStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
