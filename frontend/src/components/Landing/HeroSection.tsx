import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import AnimatedButton from './AnimatedButton';
import BoardPreview from './BoardPreview';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white py-16 lg:py-24">
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[480px] h-[480px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(109,79,224,0.12) 0%, transparent 70%)', top: '-8%', left: '-8%' }}
          animate={{ x: [0, 40, 0], y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[380px] h-[380px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(238,70,188,0.1) 0%, transparent 70%)', bottom: '-5%', right: '-5%' }}
          animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut', delay: 1.5 }}
        />
      </div>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 relative z-10">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div className="max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 text-xs font-medium text-accent-purple bg-accent-purple/10 border border-accent-purple/20 rounded-full px-3 py-1.5 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse" />
              Free forever. No credit card.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.1] tracking-tight text-text-primary mb-5"
            >
              Every task and deadline,
              <br />
              <span className="bg-gradient-to-r from-[#6D4FE0] via-[#EE46BC] to-[#F79009] bg-clip-text text-transparent">
                organized in one place.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base text-text-secondary leading-relaxed mb-8"
            >
              Plan in List or Board view, track progress on a Dashboard, and keep deadlines on the Calendar.
              It all lives in one place, built for teams that move fast.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4"
            >
              <AnimatedButton to="/signup" variant="primary" size="lg" glow>
                Get Started Free <ArrowRight size={16} />
              </AnimatedButton>
              <AnimatedButton to="/login" variant="ghost" size="lg">
                Log in
              </AnimatedButton>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-6 bg-gradient-to-br from-purple-200/40 via-pink-200/20 to-amber-200/30 rounded-3xl blur-2xl -z-10" />
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <BoardPreview />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
