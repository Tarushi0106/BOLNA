require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const authRoutes = require('./routes/auth')
const dashboardRoutes = require('./routes/dashboard')
const app = express()
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'],
  credentials: true
}))
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
const PORT = process.env.PORT || 5000
async function start(){
  const uri = process.env.MONGO_URI
  if(!uri){
    console.error('MONGO_URI not provided')
    process.exit(1)
  }
  await mongoose.connect(uri)
  app.listen(PORT, ()=>console.log('Server running on port',PORT))
}
start().catch(err=>{
  console.error(err)
  process.exit(1)
})
