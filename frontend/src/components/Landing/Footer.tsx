import { Link } from 'react-router-dom';
import AnimatedButton from './AnimatedButton';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-border py-12">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 flex flex-col items-center text-center gap-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #EE46BC 50%, #F79009 100%)' }}
          >
            C
          </div>
          <span className="font-bold text-lg text-text-primary">ClickUp</span>
        </Link>
        <p className="text-sm text-text-secondary max-w-xs">Ready to bring your team's work into one place?</p>
        <AnimatedButton to="/signup" variant="primary" size="md" glow>
          Get Started Free
        </AnimatedButton>
        <p className="text-xs text-text-disabled">© {new Date().getFullYear()} ClickUp Clone. A personal project, not affiliated with ClickUp.</p>
      </div>
    </footer>
  );
}
