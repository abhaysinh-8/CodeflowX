import { Code2, Globe, Search, Share2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-12 px-6 md:px-12 border-t border-white/5 bg-background">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CodeFlowX<span className="text-primary">+</span></span>
          </div>
          <p className="text-white/40 max-w-xs text-sm">
            Elevating code understanding with state-of-the-art AI. Built for modern engineering teams.
          </p>
          <div className="flex gap-4">
            <Globe className="w-5 h-5 text-white/20 hover:text-white cursor-pointer transition-colors" />
            <Search className="w-5 h-5 text-white/20 hover:text-white cursor-pointer transition-colors" />
            <Share2 className="w-5 h-5 text-white/20 hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <h4 className="text-white font-bold text-sm">Product</h4>
            <ul className="space-y-2 text-white/40 text-sm">
              <li className="hover:text-white transition-colors cursor-pointer">Features</li>
              <li className="hover:text-white transition-colors cursor-pointer">Showcase</li>
              <li className="hover:text-white transition-colors cursor-pointer">Pricing</li>
              <li className="hover:text-white transition-colors cursor-pointer">API</li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-bold text-sm">Company</h4>
            <ul className="space-y-2 text-white/40 text-sm">
              <li className="hover:text-white transition-colors cursor-pointer">About</li>
              <li className="hover:text-white transition-colors cursor-pointer">Journal</li>
              <li className="hover:text-white transition-colors cursor-pointer">Privacy</li>
              <li className="hover:text-white transition-colors cursor-pointer">Terms</li>
            </ul>
          </div>
          <div className="space-y-4 col-span-2 md:col-span-1">
            <h4 className="text-white font-bold text-sm">Subscribe</h4>
            <div className="flex gap-2">
               <input type="text" placeholder="Email" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 w-full" />
               <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold">Join</button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-12 pt-8 border-t border-white/5 text-center text-white/20 text-xs">
        © 2026 CodeFlowX+. Built by Antigravity.
      </div>
    </footer>
  );
}
