import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/" element={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">DeltaPLM</h1>
              <p className="text-muted-foreground text-lg">
                Product Lifecycle Management System
              </p>
              <p className="text-sm text-muted-foreground">
                Phase 0 scaffold complete — ready for Phase 1
              </p>
            </div>
          </div>
        } />
      </Routes>
    </div>
  )
}

export default App
