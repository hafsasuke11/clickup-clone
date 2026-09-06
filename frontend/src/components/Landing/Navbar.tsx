import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AnimatedButton from './AnimatedButton';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`sticky top-0 z-50 bg-white/95 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? 'border-b border-gray-200 shadow-sm' : 'border-b border-transparent'
      }`}
    >
      <div className="flex items-center justify-between px-6 lg:px-10 py-4 max-w-[1400px] mx-auto">
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: [0, -8, 8, 0], scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="w-9 h-9 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/20"
          >
            <span className="text-white font-bold text-sm">C</span>
          </motion.div>
          <span className="font-bold text-xl tracking-tight text-gray-900">ClickUp</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <AnimatedButton to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Log in
          </AnimatedButton>
          <AnimatedButton to="/signup" variant="primary" size="sm" glow>
            Get Started Free
          </AnimatedButton>
        </div>
      </div>
    </motion.nav>
  );
}
