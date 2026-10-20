"use client";
import { Sparkles } from 'lucide-react';
import MusicPlayer from './components/musicPlayer';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-t from-[#1ed760] via-[#baf3cc] to-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="z-10 text-center space-y-6 max-w-sm w-full bg-[#181818] p-8 rounded-[40px] shadow-xl border border-[#282828]">
       <div className="relative inline-block p-4 bg-[#242424] rounded-full shadow-[0_0_24px_rgba(30,215,96,0.18)]">
          <Sparkles className="text-[#1ed760] w-12 h-12 animate-bounce" />
       </div>

        <h1 className="text-2xl font-bold text-white">เลือกเพลงจากความรู้สึก</h1>
        <p className="text-sm text-[#b3b3b3] mb-2">สุ่มข้อความจากเพลงที่เลือกได้เลย ✨</p>

        <MusicPlayer />
      </div>
      <div className="z-10 text-center text-xs text-white mt-4">
        สร้างจากความรู้สึก | ฟังเพลงไปด้วยกันนะ 🎧
      </div>
    </div>
  );
}
