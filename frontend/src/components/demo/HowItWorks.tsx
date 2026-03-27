import { motion } from 'framer-motion';
import { Terminal, Send, Eye } from 'lucide-react';

const steps = [
  {
    icon: Terminal,
    title: "Import Your Repository",
    description: "Connect your GitHub or paste a snippet. Support for JS, TS, Python, and Rust out of the box."
  },
  {
    icon: Send,
    title: "AI Analysis",
    description: "Our engine parses your code, identifying logic paths, dependencies, and potential bottlenecks."
  },
  {
    icon: Eye,
    title: "Explore Visually",
    description: "Navigate your code in a 3D space. Simulate execution and visualize state transitions."
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 md:px-12 bg-white/[0.02]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <div className="w-full md:w-1/2">
            <h2 className="text-4xl font-bold mb-8 tracking-tight">How <span className="text-gradient">CodeFlowX+</span> Works</h2>
            <div className="space-y-8">
              {steps.map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.2 }}
                  viewport={{ once: true }}
                  className="flex gap-6"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full glass border-primary/30 flex items-center justify-center text-primary font-bold">
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{step.title}</h4>
                    <p className="text-white/40 text-sm">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/2 flex justify-center">
            <div className="relative w-full max-w-md aspect-square glass rounded-3xl p-8 border-white/5 flex items-center justify-center shadow-2xl shadow-blue-500/10 transition-transform hover:scale-105 duration-500">
               <div className="absolute inset-4 border border-dashed border-white/10 rounded-2xl animate-spin-slow" />
               <div className="z-10 text-center">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/40">
                    <Terminal className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-white font-mono text-sm">npm install @codeflow/cli</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
