import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'USAII Pitch Coach',
  description: 'AI-powered pitch coaching with real-time feedback on your delivery and slides.',
};

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-950 text-white px-6">
      <main className="flex flex-col items-center text-center gap-8 max-w-lg">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">USAII Pitch Coach</h1>
          <p className="text-lg text-white/60 leading-relaxed">
            Practice your pitch with an AI coach that watches your delivery, listens to your voice,
            and reviews your slides in real time.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button asChild size="lg" className="bg-white text-zinc-950 hover:bg-white/90 font-semibold px-8 rounded-full h-12">
            <Link href="/pitch-session">Start Pitch Session</Link>
          </Button>
        </div>

        <ul className="flex flex-col gap-2 text-sm text-white/40 text-left w-full">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            Camera coaching — real-time delivery feedback
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            Voice analysis — pace, clarity, and filler words
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            Slide review — share your deck and get visual feedback
          </li>
        </ul>
      </main>
    </div>
  );
}
