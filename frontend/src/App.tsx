import { useState } from 'react'
import Header from './Header.tsx'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <Header />
    <h1>123</h1>
      <section id="center">
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onKeyDown={(e) => console.log('@@@这里是打印的日志,',e)}
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>
    </>
  )
}

export default App
