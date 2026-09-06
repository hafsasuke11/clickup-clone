import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

type Variant = 'primary' | 'outline' | 'ghost';

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  to?: string;
  variant?: Variant;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-sm rounded-xl',
  lg: 'px-8 py-3.5 text-base rounded-xl',
};

export default function AnimatedButton({
  children,
  onClick,
  to,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled = false,
  size = 'md',
  glow = false,
}: AnimatedButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (disabled) return;
    if (to) navigate(to);
    else onClick?.();
  };

  const base =
    'relative overflow-hidden font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<Variant, string> = {
    primary:
      'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:shadow-xl',
    outline:
      'bg-white text-gray-900 border border-gray-300 hover:border-purple-300 hover:bg-purple-50/50',
    ghost:
      'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  };

  return (
    <div className="relative inline-flex">
      {/* Pulsing glow ring for main CTA */}
      {glow && variant === 'primary' && !disabled && (
        <motion.span
          className="absolute inset-0 rounded-xl bg-purple-500/40 blur-md"
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <motion.button
        type={type}
        disabled={disabled}
        onClick={handleClick}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        whileHover={disabled ? {} : { scale: 1.03, y: -1 }}
        whileTap={disabled ? {} : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {/* Shimmer sweep on primary */}
        {variant === 'primary' && !disabled && (
          <motion.span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
            initial={{ x: '-150%' }}
            whileHover={{ x: '150%' }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      </motion.button>
    </div>
  );
}
