"use client";

import { FormEvent, Suspense, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Copy, Heart, Plus, Trash2, Sparkles } from 'lucide-react';
import MusicPlayer, { type MusicPlayerSong } from './components/musicPlayer';

interface SongInput {
  id: number;
  url: string;
}

function getYouTubeId(value: string): string | null {
  const input = value.trim();
  if (/^[\w-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id: string | null = null;

    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      id = url.searchParams.get('v')
        ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
        ?? null;
    }

    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function SeaLoveApp() {
  const searchParams = useSearchParams();
  const messageFromUrl = searchParams.get('msg');
  const songsFromUrl = searchParams.get('songs');
  const hasShareParameters = searchParams.has('msg') || searchParams.has('songs');
  const nextInputId = useRef(2);

  const sharedSongIds = useMemo(() => {
    if (!songsFromUrl) return [];
    const ids = songsFromUrl.split(',');
    if (ids.length > 5 || ids.some((id) => !/^[\w-]{11}$/.test(id))) return [];
    return ids;
  }, [songsFromUrl]);

  const sharedSongs = useMemo<MusicPlayerSong[]>(
    () => sharedSongIds.map((id, index) => ({
      id: index + 1,
      title: `เพลงที่ ${index + 1} 🎧`,
      src: `https://www.youtube.com/watch?v=${id}`,
      lyrics: [],
    })),
    [sharedSongIds]
  );

  const isReceiverMode = Boolean(
    messageFromUrl?.trim() &&
    messageFromUrl.length <= 500 &&
    sharedSongs.length > 0
  );
  const isInvalidSharedLink = hasShareParameters && !isReceiverMode;

  const [message, setMessage] = useState("");
  const [songInputs, setSongInputs] = useState<SongInput[]>([{ id: 1, url: "" }]);
  const [generatedLink, setGeneratedLink] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hasCopied, setHasCopied] = useState(false);

  const addSongInput = () => {
    if (songInputs.length >= 5) return;
    setSongInputs((current) => [
      ...current,
      { id: nextInputId.current++, url: "" },
    ]);
  };

  const removeSongInput = (inputId: number) => {
    setSongInputs((current) => current.filter((input) => input.id !== inputId));
  };

  const updateSongInput = (inputId: number, url: string) => {
    setSongInputs((current) => current.map((input) =>
      input.id === inputId ? { ...input, url } : input
    ));
  };

  const copyText = async (value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // Fall back to selection-based copy on non-secure origins.
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand('copy');
    } finally {
      textarea.remove();
    }
  };

  const copyGeneratedLink = async () => {
    try {
      if (await copyText(generatedLink)) {
        setHasCopied(true);
        setFeedback("คัดลอกลิงก์แล้ว ส่งให้คนพิเศษได้เลย 💚");
        return;
      }
    } catch {
      // Keep the generated URL available for manual copying.
    }
    setHasCopied(false);
    setFeedback("คัดลอกไม่สำเร็จ เลือกคัดลอกจากช่องลิงก์ได้เลย");
  };

  const generateLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setGeneratedLink("");
    setHasCopied(false);

    if (!message.trim()) {
      setFeedback("พิมพ์ข้อความก่อนสร้างลิงก์นะ");
      return;
    }
    if (message.trim().length > 500) {
      setFeedback("ข้อความยาวเกินไป กรุณาใช้ไม่เกิน 500 ตัวอักษร");
      return;
    }

    const filledInputs = songInputs.filter((input) => input.url.trim());
    const ids = filledInputs.map((input) => getYouTubeId(input.url));
    if (filledInputs.length === 0) {
      setFeedback("กรุณาใส่ลิงก์ YouTube อย่างน้อย 1 เพลง");
      return;
    }
    if (ids.some((id) => id === null)) {
      setFeedback("มีลิงก์ YouTube ที่ไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่");
      return;
    }
    const validIds = ids.filter((id): id is string => id !== null);

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: { message: message.trim(), songIds: validIds },
        }),
      });
      const result: unknown = await response.json();

      if (
        !response.ok ||
        typeof result !== 'object' ||
        result === null ||
        !('code' in result) ||
        typeof result.code !== 'string' ||
        !/^[A-Za-z0-9_-]{8}$/.test(result.code)
      ) {
        const errorMessage =
          typeof result === 'object' && result !== null && 'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'ไม่สามารถสร้างลิงก์ได้';
        throw new Error(errorMessage);
      }

      const link = new URL(`/s/${result.code}`, window.location.origin).toString();
      setGeneratedLink(link);
      if (await copyText(link)) {
        setHasCopied(true);
        setFeedback("คัดลอกลิงก์แล้ว ส่งให้คนพิเศษได้เลย 💚");
      } else {
        setFeedback("สร้างลิงก์แล้ว แต่คัดลอกไม่สำเร็จ เลือกคัดลอกจากช่องลิงก์ได้เลย");
      }
    } catch (error) {
      console.error('Failed to generate shared link', error);
      setFeedback(
        error instanceof Error && error.message === 'Shared links are not configured'
          ? 'ยังไม่ได้ตั้งค่า Supabase ใน Vercel กรุณาตั้งค่าแล้วลองใหม่'
          : 'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      );
    }
  };

  if (isInvalidSharedLink) {
    return (
      <main className="min-h-screen bg-gradient-to-t from-[#1ed760] via-[#baf3cc] to-white flex items-center justify-center p-4">
        <section className="w-full max-w-sm rounded-[32px] border border-[#282828] bg-[#181818] p-8 text-center text-white shadow-xl">
          <h1 className="text-xl font-bold">ลิงก์เพลงนี้ไม่ถูกต้อง</h1>
          <p className="mt-3 text-sm text-[#b3b3b3]">
            ลิงก์ต้องมีข้อความและเพลง YouTube อย่างน้อย 1 เพลง และไม่เกิน 5 เพลง
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

  return (
    <main className="min-h-screen bg-gradient-to-t from-[#1ed760] via-[#baf3cc] to-white flex flex-col items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-[36px] border border-[#282828] bg-[#181818] p-6 sm:p-8 text-center text-white shadow-xl">
        {isReceiverMode ? (
          <>
            <div className="mx-auto inline-flex rounded-full bg-[#242424] p-4">
              <Heart className="h-12 w-12 animate-pulse fill-[#1ed760] text-[#1ed760]" />
            </div>
            <h1 className="mt-5 text-2xl font-bold">มีคนส่งเพลงมาให้คุณ 💚</h1>
            <p className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-[#333333] bg-[#242424] p-5 text-base text-white">
              {messageFromUrl}
            </p>
            <MusicPlayer key={songsFromUrl} sharedSongs={sharedSongs} />
            <Link
              href="/"
              className="mt-5 inline-flex text-sm text-[#b3b3b3] underline decoration-[#1ed760] underline-offset-4 transition hover:text-white"
            >
              สร้างเพลย์ลิสต์ส่งเพลงบ้าง
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto inline-flex rounded-full bg-[#242424] p-4">
              <Sparkles className="h-12 w-12 animate-pulse text-[#1ed760]" />
            </div>
            <h1 className="mt-5 text-2xl font-bold">ส่งต่อเพลงพร้อมข้อความ</h1>
            <p className="mt-2 text-sm text-[#b3b3b3]">
              สร้างลิงก์เพลย์ลิสต์ให้คนพิเศษ 🎧
            </p>

            <form onSubmit={generateLink} className="mt-6 space-y-5 text-left">
              <label className="block text-sm font-medium text-[#b3b3b3]" htmlFor="share-message">
                ข้อความที่จะส่ง
                <textarea
                  id="share-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="พิมพ์ข้อความจากใจ..."
                  className="mt-2 w-full resize-none rounded-xl border border-[#444444] bg-[#242424] p-3 text-sm text-white outline-none placeholder:text-[#777777] focus:border-[#1ed760]"
                />
                <span className="mt-1 block text-right text-xs text-[#777777]">
                  {message.length}/500
                </span>
              </label>

              <div>
                <p className="text-sm font-medium text-[#b3b3b3]">
                  ลิงก์ YouTube (สูงสุด 5 เพลง)
                </p>
                <div className="mt-2 space-y-2">
                  {songInputs.map((input, index) => (
                    <div key={input.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="url"
                        value={input.url}
                        onChange={(event) => updateSongInput(input.id, event.target.value)}
                        placeholder="https://youtu.be/..."
                        aria-label={`ลิงก์เพลง ${index + 1}`}
                        className="w-full rounded-xl border border-[#444444] bg-[#242424] px-3 py-2.5 text-xs text-white outline-none placeholder:text-[#777777] focus:border-[#1ed760]"
                      />
                      {songInputs.length > 1 && (
                        <button
                          onClick={() => removeSongInput(input.id)}
                          type="button"
                          aria-label={`ลบช่องเพลง ${index + 1}`}
                          className="rounded-lg p-2 text-red-400 transition hover:bg-[#333333] hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {songInputs.length < 5 && (
                  <button
                    onClick={addSongInput}
                    type="button"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-[#1ed760] transition hover:text-[#1fdf64]"
                  >
                    <Plus className="h-4 w-4" />
                    เพิ่มเพลง
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1ed760] px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-[#1fdf64] active:scale-[0.98]"
              >
                {hasCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {hasCopied ? "คัดลอกลิงก์แล้ว" : "สร้างลิงก์และคัดลอก"}
              </button>
            </form>

            {feedback && (
              <p role="status" className="mt-4 text-sm text-[#b3b3b3]">{feedback}</p>
            )}
            {generatedLink && (
              <div className="mt-4 text-left text-xs text-[#b3b3b3]">
                <label htmlFor="generated-link">ลิงก์สำหรับแชร์</label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="generated-link"
                    readOnly
                    value={generatedLink}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-xl border border-[#444444] bg-[#242424] px-3 py-2 text-xs text-white outline-none focus:border-[#1ed760]"
                  />
                  <button
                    type="button"
                    onClick={copyGeneratedLink}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1ed760] px-3 py-2 font-semibold text-black transition hover:bg-[#1fdf64]"
                  >
                    {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {hasCopied ? "คัดลอกแล้ว" : "คัดลอก"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <p className="mt-4 text-center text-xs text-[#333333]">
        สร้างจากความรู้สึก | ฟังเพลงไปด้วยกันนะ 🎧
      </p>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-t from-[#1ed760] via-[#baf3cc] to-white flex items-center justify-center p-4">
          <p className="rounded-2xl bg-[#181818] px-6 py-4 text-sm text-[#b3b3b3]">
            กำลังเตรียมเพลย์ลิสต์... 🎧
          </p>
        </main>
      }
    >
      <SeaLoveApp />
    </Suspense>
  );
}
