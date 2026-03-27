import { useState } from 'react'
import { LandingPage } from './pages/Landing'
import Dashboard from './pages/Dashboard'

function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <main className="selection:bg-blue-500/30 selection:text-white">
      {showDashboard ? (
        <div className="relative">
          <button 
            onClick={() => setShowDashboard(false)}
            className="fixed top-4 right-10 z-50 glass px-4 py-2 rounded-full text-xs font-bold text-white/40 hover:text-white transition-colors"
          >
            Back to Landing
          </button>
          <Dashboard />
        </div>
      ) : (
        <div className="relative">
           {/* Intercept the Get Started button clicks from Hero/Navbar to show dashboard */}
           {/* In a real app we would use react-router, but for this demo I'll just use a click handler on the body or pass it down */}
           <div onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.textContent?.includes('Get Started') || target.textContent?.includes('Log in') || target.textContent?.includes('Try Sandbox')) {
                setShowDashboard(true);
                window.scrollTo(0,0);
              }
           }}>
             <LandingPage />
           </div>
        </div>
      )}
    </main>
  )
}

export default App
