import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/Landing';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <main className="selection:bg-blue-500/30 selection:text-white">
        <Routes>
          <Route path="/"          element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
