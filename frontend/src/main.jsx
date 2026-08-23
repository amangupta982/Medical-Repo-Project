import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
<<<<<<< HEAD
=======
import { Toaster } from 'react-hot-toast'
>>>>>>> origin/main
import { ThemeProvider } from './components/ThemeContext.jsx'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
<<<<<<< HEAD
=======
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid rgba(56,90,150,0.3)',
              borderRadius: '10px',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
>>>>>>> origin/main
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
