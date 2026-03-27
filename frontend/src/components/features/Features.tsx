import { motion } from 'framer-motion';
import { GitBranch, Activity, Share2, Search } from 'lucide-react';

const features = [
  {
    title: "Visual Flowcharts",
    description: "Convert complex logic into interactive flowcharts automatically. Understand deep nesting in seconds.",
    icon: GitBranch,
    color: "blue"
  },
  {
    title: "Execution Simulation",
    description: "Step through your code visually. See state changes and logic paths without setting up a debugger.",
    icon: Activity,
    color: "purple"
  },
  {
    title: "Dependency Mapping",
    description: "Map every module, function, and variable dependency. No more broken imports or hidden side-effects.",
    icon: Share2,
    color: "pink"
  },
  {
    title: "Heatmap Analysis",
    description: "Identify performance bottlenecks and dead code with our advanced coverage heatmaps.",
    icon: Search,
    color: "orange"
  }
];

export function Features() {
  return (
    <section id="features" className="py-24 px-6 md:px-12 relative overflow-hidden">
      <div className="glow-blue w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
      
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">The Future of Code <span className="text-gradient">Understanding</span></h2>
        <p className="text-white/60 max-w-2xl mx-auto">
          CodeFlowX+ combines state-of-the-art AI with advanced visualization to give you deep insights into your software.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            viewport={{ once: true }}
            className="glass-card group"
          >
            <div className={`w-12 h-12 rounded-xl bg-${feature.color}-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
              <feature.icon className={`w-6 h-6 text-${feature.color}-400`} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
            <p className="text-white/40 text-sm leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
