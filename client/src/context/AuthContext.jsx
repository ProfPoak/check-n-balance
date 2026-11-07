import { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch } from '../api.js'

const AuthContext = null

export function useAuth() {
}

export function AuthProvider({ children }) {

  function applySession(res) {
  }

  useEffect(() => {
  }, [])

  function retrySession() {
  }

  async function login(email, password) {
  }

  async function signup(email, password) {
  }

  async function logout() {
  }

  return children
}
