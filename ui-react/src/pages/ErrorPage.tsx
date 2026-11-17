const messages: Record<number, { title: string; text: string }> = {
  401: { title: 'Unauthorized', text: 'You must sign in to view this page' },
  404: { title: 'Not Found', text: 'This page does not exist' },
  502: { title: 'Bad Gateway', text: 'The service is not responding. It may still be starting up' },
}

export default function ErrorPage({ code }: { code: 401 | 404 | 502 }) {
  const m = messages[code]
  return (
    <section className="card error-page">
      <h4>
        {code} {m.title}
      </h4>
      <h2>{m.text}</h2>
      <p>
        <a href={import.meta.env.BASE_URL}>Back to home</a>
      </p>
    </section>
  )
}
