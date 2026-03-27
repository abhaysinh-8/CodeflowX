import { motion } from 'framer-motion';
import { ArrowRight, Play, Code2 } from 'lucide-react';
import Spline from '@splinetool/react-spline';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex flex-col md:flex-row items-center justify-between px-6 pt-24 md:px-12 md:pt-0 overflow-hidden">
      {/* Background Glows */}
      <div className="glow-blue w-[500px] h-[500px] -top-20 -left-20 animate-pulse-slow" />
      <div className="glow-purple w-[600px] h-[600px] -bottom-20 -right-20 animate-pulse-slow" />

      {/* Left Content */}
      <div className="w-full md:w-1/2 flex flex-col items-start gap-8 z-10 py-12">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 group cursor-default">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-medium text-white/70">v1.2: New FlowChart Engine</span>
            <ArrowRight className="w-3 h-3 text-white/40 group-hover:translate-x-1 transition-transform" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-4 tracking-tighter">
            Understand Code <br />
            <span className="text-gradient">Visually</span>, Not Just Textually
          </h1>
          
          <p className="text-lg md:text-xl text-white/60 max-w-xl leading-relaxed">
            The advanced AI platform that transforms complex codebases into interactive visualizations. 
            Simulate logic, map dependencies, and ship features faster than ever.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="flex flex-wrap gap-4"
        >
          <Button size="lg" className="gap-2 shadow-blue-500/25 shadow-xl" onClick={() => navigate('/dashboard')}>
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="secondary" size="lg" className="gap-2">
            <Play className="w-5 h-5 fill-current" /> View Demo
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-8 mt-4 grayscale opacity-50"
        >
          {/* Mock Logos */}
          <span className="font-bold text-2xl">VERCEL</span>
          <span className="font-bold text-2xl">LINEAR</span>
          <span className="font-bold text-2xl">GEMINI</span>
        </motion.div>
      </div>

      {/* Right Content - Spline */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="w-full md:w-1/2 h-[500px] md:h-screen relative spline-container"
      >
        <div className="absolute inset-0 z-0">
          <ErrorBoundary fallback={
            <div className="w-full h-full flex items-center justify-center bg-blue-500/5 rounded-3xl border border-white/5">
                <div className="text-center">
                   <div className="w-20 h-20 bg-blue-500/10 rounded-full animate-pulse mx-auto mb-4" />
                   <p className="text-white/20 font-mono text-xs uppercase tracking-widest">Interactive Scene Loading...</p>
                </div>
            </div>
          }>
            <Spline scene="https://prod.spline.design/7f2b650b-0a43-44c8-95ce-13b496061a55/scene.splinecode" />
          </ErrorBoundary>
        </div>
        
        {/* Floating Indicator */}
        <motion.div 
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 right-1/4 glass p-4 rounded-2xl hidden md:block z-10 border-blue-500/50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-white/40 font-medium">Flow Simulation</p>
              <p className="text-sm text-white font-bold">Active Analysis</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
