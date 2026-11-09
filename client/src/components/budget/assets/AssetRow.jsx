import { useState } from 'react'
import { apiFetch } from '../../../api.js'
import ErrorMessage from '../../shared/ErrorMessage.jsx'
import AssetForm from './AssetForm.jsx'

function AssetRow({ asset, onReplace, onRemove }) {
  return (
    <li>
      <strong>{asset.name}</strong>
      <span> ${asset.balance}</span>
      <button aria-label={`Edit ${asset.name}`}>Edit</button>
      <button aria-label={`Delete ${asset.name}`}>Delete</button>
    </li>
  )
}

export default AssetRow
