import Link from 'next/link';
import { Heart } from 'lucide-react';
import MusicPlayer, { type MusicPlayerSong } from '../../components/musicPlayer';
import { getSharedLink } from '../../lib/sharedLinks';

export const instant = false;

export default async function SharedPlaylistPage({
  params,
}: {
  params: Promise<{ payload: string }>;
}) {
  const { payload } = await params;
  let sharedPayload = null;
  let serviceUnavailable = false;

  if (/^[A-Za-z0-9_-]{8}$/.test(payload)) {
    try {
      sharedPayload = await getSharedLink(payload);
    } catch (error) {
      console.error('Failed to load shared link', error);
      serviceUnavailable = true;
    }
  }

  if (!sharedPayload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-t from-[#1ed760] via-[#baf3cc] to-white p-4">
        <section className="w-full max-w-sm rounded-[32px] border border-[#282828] bg-[#181818] p-8 text-center text-white shadow-xl">
          <h1 className="text-xl font-bold">
            {serviceUnavailable ? 'เปิดลิงก์ไม่ได้ชั่วคราว' : 'ไม่พบลิงก์นี้'}
          </h1>
          <p className="mt-3 text-sm text-[#b3b3b3]">
            {serviceUnavailable
              ? 'ระบบจัดเก็บลิงก์ขัดข้อง กรุณาลองใหม่อีกครั้งภายหลัง'
              : 'ลิงก์อาจไม่ถูกต้องหรือไม่มีอยู่แล้ว'}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-[#1ed760] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#1fdf64]"
          >
            กลับไปหน้าแรก
          </Link>
        </section>
      </main>
    );
  }

  const sharedSongs: MusicPlayerSong[] = sharedPayload.songIds.map((id, index) => ({
    id: index + 1,
    title: `เพลงที่ ${index + 1} 🎧`,
    src: `https://www.youtube.com/watch?v=${id}`,
    lyrics: [],
  }));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-t from-[#1ed760] via-[#baf3cc] to-white p-4">
      <section className="w-full max-w-sm rounded-[36px] border border-[#282828] bg-[#181818] p-6 text-center text-white shadow-xl sm:p-8">
        <div className="mx-auto inline-flex rounded-full bg-[#242424] p-4">
          <Heart className="h-12 w-12 animate-pulse fill-[#1ed760] text-[#1ed760]" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">มีคนส่งเพลงมาให้คุณ 💚</h1>
        <p className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-[#333333] bg-[#242424] p-5 text-base text-white">
          {sharedPayload.message}
        </p>
        <MusicPlayer key={payload} sharedSongs={sharedSongs} />
        <Link
          href="/"
          className="mt-5 inline-flex text-sm text-[#b3b3b3] underline decoration-[#1ed760] underline-offset-4 transition hover:text-white"
        >
          สร้างเพลย์ลิสต์ส่งเพลงบ้าง
        </Link>
      </section>
      <p className="mt-4 text-center text-xs text-[#333333]">
        สร้างจากความรู้สึก | ฟังเพลงไปด้วยกันนะ 🎧
      </p>
    </main>
  );
}
