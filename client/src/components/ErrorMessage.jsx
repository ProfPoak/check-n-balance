function toMessages(data) {
  if (typeof data.error === 'string') {
    return [data.error]
  }
  const errors = data.errors
  if (Array.isArray(errors)) {
    return errors
  }
  if (errors && typeof errors === 'object') {
    const result = []
    Object.entries(errors).forEach(([key, value]) => {
      const list = Array.isArray(value) ? value : [value]
      list.forEach((message) => {
        result.push(key === '_schema' ? message : `${key}: ${message}`)
      })
    })
    return result
  }
  return []
}

function ErrorMessage({ data }) {
  if (data === null || data === undefined) {
    return null
  }
  const messages = toMessages(data)
  if (messages.length === 0) {
    messages.push('Something went wrong')
  }
  return (
    <ul role="alert">
      {messages.map((message, index) => (
        <li key={index}>
          {message}
        </li>
      ))}
    </ul>
  )
}

export default ErrorMessage
