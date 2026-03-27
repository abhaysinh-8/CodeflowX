import { Navbar } from '../components/layout/Navbar';
import { Hero } from '../components/hero/Hero';
import { Features } from '../components/features/Features';
import { HowItWorks } from '../components/demo/HowItWorks';
import { DemoPreview } from '../components/features/DemoPreview';
import { Footer } from '../components/layout/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <DemoPreview />
      <Footer />
    </div>
  );
}
