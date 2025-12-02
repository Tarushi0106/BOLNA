import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

export default function Dashboard(){
  const [profile,setProfile]=useState(null)
  const [stats,setStats]=useState(null)
  const [calls,setCalls]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const navigate=useNavigate()

  useEffect(()=>{
    const token=localStorage.getItem('token')
    if(!token){
      navigate('/login')
      return
    }
    fetchData(token)
  },[navigate])

  async function fetchData(token){
    try{
      const [profileRes,statsRes,callsRes]=await Promise.all([
        fetch('http://localhost:5000/api/dashboard/profile',{
          headers:{'Authorization':`Bearer ${token}`}
        }),
        fetch('http://localhost:5000/api/dashboard/stats',{
          headers:{'Authorization':`Bearer ${token}`}
        }),
        fetch('http://localhost:5000/api/dashboard/calls',{
          headers:{'Authorization':`Bearer ${token}`}
        })
      ])
      const profileData=await profileRes.json()
      const statsData=await statsRes.json()
      const callsData=await callsRes.json()
      if(!profileRes.ok||!statsRes.ok||!callsRes.ok){
        setError('Failed to load dashboard data')
        setLoading(false)
        return
      }
      setProfile(profileData)
      setStats(statsData)
      setCalls(Array.isArray(callsData) ? callsData : [])
    }catch(err){
      setError('Network error')
    }
    setLoading(false)
  }

  function logout(){
    localStorage.removeItem('token')
    navigate('/login')
  }

  if(loading) return <div className="dashboard"><p>Loading...</p></div>
  if(error) return <div className="dashboard"><p style={{color:'var(--error)'}}>{error}</p></div>

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h2>Dashboard</h2>
          <p className="greeting">Welcome back, {profile?.name}!</p>
        </div>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h4>Your Name</h4>
          <p className="stat-value">{profile?.name}</p>
        </div>
        <div className="stat-card">
          <h4>Email</h4>
          <p className="stat-value" style={{fontSize:'14px'}}>{profile?.email}</p>
        </div>
        <div className="stat-card">
          <h4>Total Users</h4>
          <p className="stat-value">{stats?.totalUsers}</p>
        </div>
        <div className="stat-card">
          <h4>Total Calls</h4>
          <p className="stat-value">{stats?.totalCalls}</p>
        </div>
      </div>

      <section className="dash-body">
        <h3>Profile Information</h3>
        <div className="profile-info">
          <div className="info-row">
            <span>User ID:</span>
            <span>{profile?._id}</span>
          </div>
          <div className="info-row">
            <span>Email:</span>
            <span>{profile?.email}</span>
          </div>
          <div className="info-row">
            <span>Name:</span>
            <span>{profile?.name}</span>
          </div>
          <div className="info-row">
            <span>Member Since:</span>
            <span>{new Date(profile?.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </section>

      <section className="dash-body calls-section">
        <h3>Recent Calls ({calls.length})</h3>
        {calls.length === 0 ? (
          <p style={{color:'var(--text-muted)'}}>No calls found</p>
        ) : (
          <div className="calls-table">
            <div className="table-header">
              <div className="col-phone">Phone</div>
              <div className="col-name">Name</div>
              <div className="col-call">Call Status</div>
              <div className="col-summary">Summary</div>
            </div>
            {calls.map((call,idx)=>(
              <div key={idx} className="table-row">
                <div className="col-phone">{call.Phone || 'N/A'}</div>
                <div className="col-name">{call.Name || 'N/A'}</div>
                <div className="col-call">{call.Call || 'N/A'}</div>
                <div className="col-summary">{call.Summary ? call.Summary.substring(0,80)+'...' : 'N/A'}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
