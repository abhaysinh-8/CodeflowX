import { motion } from 'framer-motion';
import { Code2, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md border-b border-white/5 bg-background/50"
    >
      <div className="flex items-center gap-2">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
          <Code2 className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">CodeFlowX<span className="text-primary">+</span></span>
      </div>

      {/* Desktop Menu */}
      <div className="hidden md:flex items-center gap-8">
        <a href="#features" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Features</a>
        <a href="#how-it-works" className="text-sm font-medium text-white/70 hover:text-white transition-colors">How it Works</a>
        <a href="#demo" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Showcase</a>
        <Button variant="ghost" className="text-sm">Log in</Button>
        <Button variant="primary" size="sm" className="shadow-blue-500/25 shadow-lg">Get Started</Button>
      </div>

      {/* Mobile Toggle */}
      <button className="md:hidden text-white" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* Mobile Menu */}
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 p-6 bg-background border-b border-white/10 flex flex-col gap-4 md:hidden"
        >
          <a href="#features" className="text-lg font-medium text-white/70">Features</a>
          <a href="#how-it-works" className="text-lg font-medium text-white/70">How it Works</a>
          <a href="#demo" className="text-lg font-medium text-white/70">Showcase</a>
          <hr className="border-white/5" />
          <Button variant="ghost">Log in</Button>
          <Button variant="primary">Get Started</Button>
        </motion.div>
      )}
    </motion.nav>
  );
}
