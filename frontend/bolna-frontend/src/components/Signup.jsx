import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './AuthForm.css'
export default function Signup(){
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const navigate=useNavigate()
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
  async function submit(e){
    e.preventDefault()
    setError('')
    if(!name||!email||!password){
      setError('All fields are required')
      return
    }
    if(password.length<6){
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try{
     const res = await fetch(`${API_BASE}/api/auth/signup`, {

        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,email,password})
      })
      const data=await res.json()
      if(!res.ok){
        setError(data.message||'Signup failed')
        setLoading(false)
        return
      }
      localStorage.setItem('token',data.token)
      localStorage.setItem('user', JSON.stringify({ email: email, name: name }))
      navigate('/dashboard')
    }catch(err){
      setError('Network error: unable to reach server')
    }
    setLoading(false)
  }
  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Get started</h2>
        <p className="subtitle">Create your account to begin</p>
        <form onSubmit={submit}>
          <label>
            Full name
            <input value={name} onChange={e=>setName(e.target.value)} type="text" placeholder="John Doe" required />
          </label>
          <label>
            Email address
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••" required minLength={6} />
          </label>
          {error && <div className="error">{error}</div>}
          <button disabled={loading} type="submit">{loading? 'Creating account...':'Create Account'}</button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
