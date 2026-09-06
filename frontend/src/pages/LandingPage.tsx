import Navbar from '@/components/Landing/Navbar';
import HeroSection from '@/components/Landing/HeroSection';
import FeaturesStrip from '@/components/Landing/FeaturesStrip';
import Footer from '@/components/Landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-text-primary overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturesStrip />
      <Footer />
    </div>
  );
}
