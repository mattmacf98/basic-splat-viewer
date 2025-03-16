import { useEffect, useRef } from 'react'
import { RenderEngine } from './RenderEngine';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      RenderEngine.init(canvasRef.current)
    }
  }, [canvasRef])

  return (
    <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 256}}>
      <canvas width="800" height="600" style={{ border: '1px solid black', display: 'block', margin: '0 auto' }} ref={canvasRef}></canvas>
    </div>
  )
}

export default App
