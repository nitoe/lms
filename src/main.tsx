import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SiswaProvider } from './context/SiswaContext'
import App from './App'
import './index.css'
import './styles/siswa.css'
import './styles/materi-halaman.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SiswaProvider>
          <App />
        </SiswaProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
