import { Button } from '../ui/Button';
import { Layout, Maximize2, ShieldCheck, Zap } from 'lucide-react';

export function DemoPreview() {
  return (
    <section id="demo" className="py-24 px-6 md:px-12 relative">
      <div className="max-w-7xl mx-auto">
        <div className="glass rounded-[2rem] p-4 md:p-8 border-white/5 shadow-[0_0_80px_rgba(59,130,246,0.1)] overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
               <div className="flex gap-1.5 px-3">
                 <div className="w-3 h-3 rounded-full bg-red-500/50" />
                 <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                 <div className="w-3 h-3 rounded-full bg-green-500/50" />
               </div>
               <div className="h-6 w-48 bg-white/5 rounded-full flex items-center px-3 text-[10px] text-white/20 font-mono">
                 codeflowx.plus/dashboard/project-ai-core
               </div>
            </div>
            <Button size="sm" variant="glass" className="h-9">Try Sandbox</Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
            {/* Sidebar Mock */}
            <div className="w-full lg:w-16 h-full glass border-white/5 rounded-2xl flex items-center lg:flex-col py-4 gap-6 justify-center">
               <Layout className="w-6 h-6 text-primary" />
               <Zap className="w-6 h-6 text-white/20" />
               <ShieldCheck className="w-6 h-6 text-white/20" />
               <Maximize2 className="w-6 h-6 text-white/20" />
            </div>

            {/* Main Area Mock */}
            <div className="flex-grow flex flex-col gap-6">
              <div className="h-1/2 glass border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                 <div className="absolute top-4 left-6 text-xs text-white/30 font-mono uppercase tracking-widest">Code Editor</div>
                 <div className="mt-8 font-mono text-sm space-y-2">
                   <p><span className="text-purple-400">async function</span> <span className="text-blue-400">analyzeCore</span>() {'{'}</p>
                   <p className="pl-4 text-white/40 font-mono italic">// AI Analysis in progress...</p>
                   <p className="pl-4"><span className="text-purple-400">const</span> results = <span className="text-purple-400">await</span> engine.<span className="text-blue-400">process</span>(data);</p>
                   <p className="pl-4"><span className="text-purple-400">return</span> results;</p>
                   <p>{'}'}</p>
                 </div>
                 <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/10 blur-[100px]" />
              </div>
              <div className="h-1/2 glass border-blue-500/20 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                 <div className="absolute top-4 left-6 text-xs text-white/30 font-mono uppercase tracking-widest">Execution Flow</div>
                 {/* Visual Flow mock */}
                 <div className="flex items-center gap-8">
                    <div className="w-16 h-16 rounded-xl glass border-primary/50 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-primary" />
                    </div>
                    <div className="w-12 h-0.5 bg-gradient-to-r from-primary to-accent" />
                    <div className="w-20 h-20 rounded-2xl glass border-accent/50 flex items-center justify-center relative">
                       <ShieldCheck className="w-10 h-10 text-accent" />
                       <div className="absolute -inset-2 border border-accent/20 rounded-2xl animate-ping" />
                    </div>
                 </div>
                 <Button className="mt-12" size="sm" variant="primary">Start Simulation</Button>
                 <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 blur-[100px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
