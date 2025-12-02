import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Login from './components/Login'
import Signup from './components/Signup'
import Dashboard from './components/Dashboard'

function AppContent(){
  const location=useLocation()
  const isAuthPage=location.pathname==='/'||location.pathname==='/login'||location.pathname==='/signup'
  return (
    <div className="app-shell">
      {!isAuthPage && (
        <header className="nav">
          <div className="brand">Bolna</div>
          <nav>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>
            <Link to="/dashboard">Dashboard</Link>
          </nav>
        </header>
      )}
      <main className="container">
        <Routes>
          <Route path="/" element={<Login/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/signup" element={<Signup/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
        </Routes>
      </main>
    </div>
  )
}

export default function App(){
  return (
    <Router>
      <AppContent/>
    </Router>
  )
}
