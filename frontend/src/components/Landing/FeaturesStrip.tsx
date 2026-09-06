import { ListTodo, Calendar, LayoutDashboard, Kanban, UserPlus } from 'lucide-react';
import FadeIn from './FadeIn';

const features = [
  { icon: ListTodo, title: 'List', desc: 'A clean, sortable task list for getting things done.' },
  { icon: Kanban, title: 'Board', desc: 'Drag tasks across statuses on a Kanban board.' },
  { icon: Calendar, title: 'Calendar', desc: 'See deadlines and schedules at a glance.' },
  { icon: LayoutDashboard, title: 'Dashboard', desc: "Track your team's progress in real time." },
];

export default function FeaturesStrip() {
  return (
    <section className="py-20 bg-background border-y border-border">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
        <FadeIn className="text-center mb-12 max-w-lg mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">Four views. One workspace.</h2>
          <p className="text-text-secondary text-sm">Switch between the way you work, without switching tools.</p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.08}>
              <div className="bg-surface border border-border rounded-2xl p-6 h-full hover:border-accent-purple/30 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center mb-4">
                  <f.icon size={18} className="text-accent-purple" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">{f.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3} className="mt-6">
          <div className="flex items-center gap-3 bg-surface border border-border rounded-2xl px-6 py-5 max-w-2xl mx-auto">
            <div className="w-10 h-10 rounded-xl bg-accent-pink/10 flex items-center justify-center shrink-0">
              <UserPlus size={18} className="text-accent-pink" />
            </div>
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">Invite your team</span> and start collaborating
              in seconds, with no setup needed.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
