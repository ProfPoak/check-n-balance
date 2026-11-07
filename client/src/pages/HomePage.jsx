import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api.js'
import BudgetList from '../components/BudgetList.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function HomePage() {

  useEffect(() => {
  }, [])

  async function handleNew() {
  }

  return <h1>Home</h1>
}

export default HomePage
