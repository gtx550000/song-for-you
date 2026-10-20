"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Music, 
  Volume2, 
  Volume1, 
  VolumeX, 
  Link as LinkIcon, 
  Plus,
  Square,
  Trash2,
  Sparkles,
  Pencil
} from 'lucide-react';

interface Song {
  id: number;
  title: string;
  src: string;
  lyrics: string[];
}

interface YouTubePlayer {
  cueVideoById: (videoId: string) => void;
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
}

interface YouTubePlayerEvent {
  data: number;
}

interface YouTubeIframeApi {
  Player: new (
    elementId: string,
    options: {
      height: string;
      width: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: () => void;
      };
    }
  ) => YouTubePlayer;
}

const STORAGE_KEY = 'sea-love-songs-v1';

// ลิงก์เพลงเริ่มต้น (สามารถใส่ได้ทั้ง YouTube URL และไฟล์ mp3)
const initialSongs: Song[] = [
  { id: 1, title: "จงเรียกเธอว่านางพญา", src: "https://youtu.be/KczJJtR--d4", lyrics: [] },
  { id: 2, title: "โปรดส่งใครมารักฉันที - อินสติงค์", src: "https://youtu.be/EDF7riZLhNA?si=ZHEJFNrI_os85nD3", lyrics: [] },
  { id: 3, title: "โต๊ะริม - NONT TANONT", src: "https://youtu.be/XqQMisU5En8?si=TgbaW7y7w2_ZbBjW", lyrics: [] },
  { id: 4, title: "กลิ่นดอกไม้ - Newery", src: "https://youtu.be/71KuVORecY8?si=_gJh1I9J3JB7pQE2", lyrics: [] },
  { id: 5, title: "ทรายกับทะเล", src: "https://youtu.be/dMpBjCNZE0c?si=nO6raMwVqka2_TrX", lyrics: [] },
];

function isSongList(value: unknown): value is Song[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((song) =>
      song !== null &&
      typeof song === 'object' &&
      typeof song.id === 'number' &&
      typeof song.title === 'string' &&
      typeof song.src === 'string' &&
      (song.lyrics === undefined ||
        (Array.isArray(song.lyrics) && song.lyrics.every((line: unknown) => typeof line === 'string')))
    );
}

function parseLyrics(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const cleaned = url.replace(/^\/music\//, '').trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = cleaned.match(regExp);
  if (match && match[1]) {
    return match[1];
  }
  if (/^[\w-]{11}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

export default function MusicPlayer() {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [currentSong, setCurrentSong] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isYTReady, setIsYTReady] = useState(false);
  
  // จัดการระดับเสียง (0 - 100)
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(50);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLyrics, setNewLyrics] = useState("");
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [randomLyric, setRandomLyric] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  const playerRef = useRef<YouTubePlayer | null>(null);
  const nextSongRef = useRef<() => void>(() => {});
  const currentSongRef = useRef(currentSong);
  const songsRef = useRef(songs);
  const pendingYouTubePlaybackRef = useRef<{ videoId: string; shouldPlay: boolean } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSong = songs[currentSong] || songs[0];
  const ytId = extractYouTubeId(activeSong.src);
  const isYouTube = !!ytId;

  const saveSongs = (updatedSongs: Song[]) => {
    songsRef.current = updatedSongs;
    setSongs(updatedSongs);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSongs));
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error
        ? `บันทึกเพลงไม่สำเร็จ: ${error.message}`
        : "บันทึกเพลงไม่สำเร็จ");
    }
  };

  useEffect(() => {
    let isMounted = true;
    let loadedSongs = initialSongs;
    let loadingError = "";
    try {
      const savedSongs = window.localStorage.getItem(STORAGE_KEY);
      if (savedSongs) {
        const parsedSongs: unknown = JSON.parse(savedSongs);
        if (!isSongList(parsedSongs)) {
          throw new Error("ข้อมูลเพลงที่บันทึกไว้ไม่ถูกต้อง");
        }
        loadedSongs = parsedSongs.map((song) => ({
          ...song,
          lyrics: song.lyrics ?? [],
        }));
      }
    } catch (error) {
      loadingError = error instanceof Error
        ? `โหลดเพลงที่บันทึกไว้ไม่สำเร็จ: ${error.message}`
        : "โหลดเพลงที่บันทึกไว้ไม่สำเร็จ";
    }
    queueMicrotask(() => {
      if (!isMounted) return;
      songsRef.current = loadedSongs;
      setSongs(loadedSongs);
      setLyricsDraft(loadedSongs[0].lyrics.join('\n'));
      setStorageError(loadingError);
      setStorageReady(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // โหลด YouTube IFrame API
  useEffect(() => {
    if (typeof window === "undefined") return;

    const youtubeWindow = window as Omit<Window, 'YT' | 'onYouTubeIframeAPIReady'> & {
      YT?: YouTubeIframeApi;
      onYouTubeIframeAPIReady?: () => void;
    };

    const setupPlayer = () => {
      if (!youtubeWindow.YT || !youtubeWindow.YT.Player) return;
      
      const currentYtId = extractYouTubeId(songsRef.current[currentSongRef.current]?.src) || "pt-0LgCVcUI";
      playerRef.current = new youtubeWindow.YT.Player('yt-audio-player', {
        height: '1',
        width: '1',
        videoId: currentYtId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setIsYTReady(true);
            try {
              playerRef.current?.setVolume(volume);
            } catch (_) {}
            const pendingPlayback = pendingYouTubePlaybackRef.current;
            const activeVideoId = extractYouTubeId(
              songsRef.current[currentSongRef.current]?.src ?? ""
            );
            const videoId = pendingPlayback?.videoId ?? activeVideoId;
            if (videoId && playerRef.current) {
              if (pendingPlayback?.shouldPlay) {
                playerRef.current.loadVideoById(videoId);
                setIsLoading(true);
              } else {
                playerRef.current.cueVideoById(videoId);
                setIsLoading(false);
              }
            }
            pendingYouTubePlaybackRef.current = null;
          },
          onStateChange: (event) => {
            // PLAYING = 1, PAUSED = 2, BUFFERING = 3, ENDED = 0
            if (event.data === 1) {
              setIsPlaying(true);
              setIsLoading(false);
            } else if (event.data === 2) {
              setIsPlaying(false);
              setIsLoading(false);
            } else if (event.data === 3) {
              setIsLoading(true);
            } else if (event.data === 5) {
              setIsLoading(false);
            } else if (event.data === 0) {
              setIsPlaying(false);
              nextSongRef.current();
            }
          },
          onError: () => {
            pendingYouTubePlaybackRef.current = null;
            setIsLoading(false);
            setIsPlaying(false);
          }
        },
      });
    };

    if (youtubeWindow.YT && youtubeWindow.YT.Player) {
      setupPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
      youtubeWindow.onYouTubeIframeAPIReady = () => {
        setupPlayer();
      };
    }
  }, []);

  // ฟังก์ชันปรับระดับเสียง
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }

    // ปรับเสียง YouTube
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        if (newVol === 0) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
          playerRef.current.setVolume(newVol);
        }
      } catch (_) {}
    }

    // ปรับเสียง HTML Audio
    if (audioRef.current) {
      audioRef.current.volume = newVol / 100;
      audioRef.current.muted = (newVol === 0);
    }
  };

  // ฟังก์ชันเปิด/ปิดเสียง (Mute Toggle)
  const toggleMute = () => {
    if (isMuted) {
      const restored = prevVolume > 0 ? prevVolume : 50;
      setIsMuted(false);
      handleVolumeChange(restored);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      if (playerRef.current && typeof playerRef.current.mute === 'function') {
        try {
          playerRef.current.mute();
        } catch (_) {}
      }
      if (audioRef.current) {
        audioRef.current.muted = true;
      }
    }
  };

  // เปลี่ยนเพลง
  const loadAndPlaySong = useCallback((index: number, shouldPlay = true, songList = songs) => {
    const targetSong = songList[index];
    if (!targetSong) return;

    const videoId = extractYouTubeId(targetSong.src);

    if (videoId) {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      setIsPlaying(false);
      setIsLoading(shouldPlay);
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.setVolume(isMuted ? 0 : volume);
        } catch (_) {}

        if (shouldPlay) {
          pendingYouTubePlaybackRef.current = null;
          playerRef.current.loadVideoById(videoId);
        } else {
          pendingYouTubePlaybackRef.current = null;
          playerRef.current.cueVideoById(videoId);
          setIsLoading(false);
        }
      } else {
        pendingYouTubePlaybackRef.current = { videoId, shouldPlay };
      }
    } else {
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
      }

      if (audioRef.current) {
        audioRef.current.src = targetSong.src;
        audioRef.current.volume = isMuted ? 0 : volume / 100;
        audioRef.current.muted = isMuted;
        if (shouldPlay) {
          audioRef.current.play().catch(() => setIsPlaying(false));
          setIsPlaying(true);
        }
      }
    }
  }, [songs, volume, isMuted]);

  const togglePlay = () => {
    if (isYouTube) {
      if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') {
        return;
      }
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        try {
          playerRef.current.setVolume(isMuted ? 0 : volume);
        } catch (_) {}
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } else {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        if (audioRef.current) {
          audioRef.current.volume = isMuted ? 0 : volume / 100;
        }
        audioRef.current?.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
      }
    }
  };

  const nextSong = useCallback(() => {
    const nextIndex = (currentSong + 1) % songs.length;
    currentSongRef.current = nextIndex;
    setCurrentSong(nextIndex);
    setLyricsDraft(songs[nextIndex].lyrics.join('\n'));
    setRandomLyric("");
    loadAndPlaySong(nextIndex, true);
  }, [currentSong, loadAndPlaySong, songs]);

  useEffect(() => {
    nextSongRef.current = nextSong;
  }, [nextSong]);

  const stopSong = () => {
    pendingYouTubePlaybackRef.current = null;
    if (isYouTube && playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      playerRef.current.stopVideo();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsLoading(false);
  };

  const prevSong = () => {
    const prevIndex = (currentSong - 1 + songs.length) % songs.length;
    currentSongRef.current = prevIndex;
    setCurrentSong(prevIndex);
    setLyricsDraft(songs[prevIndex].lyrics.join('\n'));
    setRandomLyric("");
    loadAndPlaySong(prevIndex, true);
  };

  const removeSong = (songId: number) => {
    if (songs.length <= 1 || !window.confirm("ต้องการลบเพลงนี้หรือไม่?")) return;

    const removedIndex = songs.findIndex((song) => song.id === songId);
    const updatedSongs = songs.filter((song) => song.id !== songId);
    saveSongs(updatedSongs);

    if (removedIndex === currentSong) {
      const nextIndex = Math.min(currentSong, updatedSongs.length - 1);
      stopSong();
      currentSongRef.current = nextIndex;
      setCurrentSong(nextIndex);
      setLyricsDraft(updatedSongs[nextIndex].lyrics.join('\n'));
      setRandomLyric("");
      loadAndPlaySong(nextIndex, false, updatedSongs);
    } else if (removedIndex < currentSong) {
      currentSongRef.current = currentSong - 1;
      setCurrentSong(currentSong - 1);
    }
  };

  const saveLyrics = () => {
    const lyrics = parseLyrics(lyricsDraft);
    const updatedSongs = songs.map((song) =>
      song.id === activeSong.id ? { ...song, lyrics } : song
    );
    saveSongs(updatedSongs);
    setRandomLyric("");
    setShowLyricsEditor(false);
  };

  const randomizeLyric = () => {
    if (activeSong.lyrics.length === 0) {
      setRandomLyric("");
      return;
    }
    setRandomLyric(activeSong.lyrics[Math.floor(Math.random() * activeSong.lyrics.length)]);
  };

  const handleAddSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const songId = extractYouTubeId(newUrl);
    if (!songId && !newUrl.endsWith(".mp3")) {
      alert("กรุณากรอกลิงก์ YouTube ที่ถูกต้อง เช่น https://youtu.be/... หรือ https://www.youtube.com/watch?v=...");
      return;
    }
    const newSongItem: Song = {
      id: Date.now(),
      title: newTitle.trim() || `เพลงโปรดที่เธอชอบ #${songs.length + 1}`,
      src: newUrl.trim(),
      lyrics: parseLyrics(newLyrics),
    };
    const updated = [...songs, newSongItem];
    saveSongs(updated);
    currentSongRef.current = updated.length - 1;
    setCurrentSong(updated.length - 1);
    setLyricsDraft(newSongItem.lyrics.join('\n'));
    setRandomLyric("");
    loadAndPlaySong(updated.length - 1, true, updated);
    setNewTitle("");
    setNewUrl("");
    setNewLyrics("");
    setShowAddModal(false);
  };

  return (
    <div className="bg-[#181818] p-4 sm:p-5 rounded-3xl mt-4 sm:mt-6 border border-[#282828] shadow-md w-full relative">
      {/* ส่วนหัวแสดงชื่อเพลง */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center space-x-2 overflow-hidden flex-1 mr-2">
          <div className={`p-1.5 rounded-full shrink-0 ${isPlaying ? 'bg-[#1ed760] text-black animate-spin' : 'bg-[#282828] text-[#b3b3b3]'}`}>
            <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-left overflow-hidden">
            <span className="text-xs sm:text-sm font-semibold text-white line-clamp-1 block">
              {activeSong.title}
            </span>
            <span className="text-[10px] text-[#b3b3b3] block truncate">
              {isLoading ? "กำลังโหลดเพลง..." : isPlaying ? "กำลังเปิดให้ฟังนะ 🩵" : "กดปุ่มเล่นเพื่อฟังเพลง"}
            </span>
          </div>
        </div>

        {/* ปุ่มเพิ่มลิงก์ YouTube ของเราเอง */}
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          disabled={!storageReady}
          className="text-[#1ed760] hover:text-[#1fdf64] bg-[#242424] hover:bg-[#333333] p-1.5 sm:p-2 rounded-full border border-[#333333] shadow-2xs transition shrink-0 active:scale-95"
          title="เพิ่มเพลงจาก YouTube"
          type="button"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          onClick={() => removeSong(activeSong.id)}
          disabled={!storageReady || songs.length <= 1}
          className="text-red-400 hover:text-red-300 bg-[#242424] hover:bg-[#333333] p-1.5 sm:p-2 rounded-full border border-[#333333] shadow-2xs transition shrink-0 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="ลบเพลงนี้"
          aria-label={`ลบเพลง ${activeSong.title}`}
          type="button"
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>

      {storageError && (
        <p role="alert" className="mb-3 text-left text-xs text-red-700">{storageError}</p>
      )}
      {!storageReady && !storageError && (
        <p className="mb-3 text-left text-xs text-[#b3b3b3]">กำลังโหลดเพลงที่บันทึกไว้...</p>
      )}
      {storageReady && !storageError && (
        <p className="mb-3 text-left text-xs text-[#b3b3b3]">บันทึกเพลงและข้อความไว้ในเบราว์เซอร์นี้แล้ว</p>
      )}

      <div className="mb-3 rounded-2xl border border-[#333333] bg-[#242424] p-3">
        <div className="min-h-12 flex items-center justify-center text-sm text-white">
          {randomLyric || (
            <span className="text-xs text-[#b3b3b3]">
              {activeSong.lyrics.length
                ? "กดสุ่มข้อความจากเพลงนี้ได้เลย"
                : "เพิ่มข้อความเพลงด้านล่างเพื่อเริ่มสุ่ม"}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            onClick={randomizeLyric}
            disabled={activeSong.lyrics.length === 0}
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-[#1ed760] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#1fdf64] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            สุ่มจากเนื้อเพลง
          </button>
          <button
            onClick={() => setShowLyricsEditor((shown) => !shown)}
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-[#333333] px-3 py-1.5 text-xs text-white transition hover:bg-[#444444]"
          >
            <Pencil className="h-3.5 w-3.5" />
            {showLyricsEditor ? "ปิด" : "แก้ข้อความ"}
          </button>
        </div>
      </div>

      {showLyricsEditor && (
        <div className="mb-3 space-y-2 text-left">
          <label className="block text-xs text-[#b3b3b3]" htmlFor="edit-song-lyrics">
            เนื้อเพลงหรือข้อความของเพลงนี้ (หนึ่งท่อนต่อบรรทัด)
          </label>
          <textarea
            id="edit-song-lyrics"
            value={lyricsDraft}
            onChange={(event) => setLyricsDraft(event.target.value)}
            rows={4}
            placeholder={"วางหรือพิมพ์ข้อความเพลง\nแยกแต่ละท่อนด้วยการขึ้นบรรทัดใหม่"}
            className="w-full resize-y rounded-xl border border-[#444444] bg-[#242424] px-3 py-2 text-xs text-white outline-none focus:border-[#1ed760]"
          />
          <button
            onClick={saveLyrics}
            disabled={!storageReady}
            type="button"
            className="rounded-lg bg-[#1ed760] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#1fdf64] disabled:opacity-50"
          >
            บันทึกข้อความ
          </button>
        </div>
      )}

      {/* คลื่นเสียงน่ารักเวลาเล่น */}
      <div className="flex justify-center items-center gap-1 my-2.5 h-3.5">
        {[40, 70, 100, 60, 90, 50, 80].map((height, i) => (
          <span
            key={i}
            className={`w-1 bg-[#1ed760] rounded-full transition-all duration-300 ${
              isPlaying ? 'animate-pulse' : 'opacity-30'
            }`}
            style={{
              height: isPlaying ? `${height}%` : '20%',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      {/* ปุ่มควบคุม Playback */}
      <div className="flex justify-center items-center space-x-5 sm:space-x-6 my-1">
        <button 
          onClick={prevSong} 
          className="p-2 text-[#b3b3b3] hover:text-white transition active:scale-90"
          type="button"
          aria-label="Previous song"
        >
          <SkipBack className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <button 
          onClick={togglePlay} 
          disabled={isYouTube && !isYTReady}
          className="bg-[#1ed760] text-black p-3.5 sm:p-4 rounded-full hover:bg-[#1fdf64] transition shadow-md active:scale-95 disabled:opacity-50"
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
          )}
        </button>

        <button
          onClick={stopSong}
          disabled={!isPlaying && !isLoading}
          className="p-2 text-[#b3b3b3] hover:text-white transition active:scale-90 disabled:opacity-50"
          type="button"
          aria-label="Stop"
          title="หยุดเพลง"
        >
          <Square className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button 
          onClick={nextSong} 
          className="p-2 text-[#b3b3b3] hover:text-white transition active:scale-90"
          type="button"
          aria-label="Next song"
        >
          <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* แถบปรับระดับเสียงแบบเลื่อน (Volume Slider) รองรับจอมือถือ */}
      <div className="mt-3.5 pt-2.5 border-t border-[#333333]">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-[#242424] rounded-2xl border border-[#333333] shadow-2xs">
          <button
            type="button"
            onClick={toggleMute}
            className="text-[#b3b3b3] hover:text-[#1ed760] transition p-1 shrink-0 active:scale-90"
            title={isMuted ? "เปิดเสียง" : "ปิดเสียง"}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-[#b3b3b3]" />
            ) : volume < 50 ? (
              <Volume1 className="w-4 h-4 text-[#1ed760]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#1ed760]" />
            )}
          </button>

          {/* Slider input เลื่อนระดับเสียง */}
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full h-1.5 bg-[#444444] rounded-lg appearance-none cursor-pointer accent-[#1ed760] transition touch-pan-x"
            aria-label="Volume Slider"
          />

          <span className="text-[10px] font-mono font-medium text-[#b3b3b3] min-w-[30px] text-right shrink-0">
            {isMuted ? "0%" : `${volume}%`}
          </span>
        </div>
      </div>

      {/* กล่องใส่ลิงก์เพลง YouTube เพิ่มเติม */}
      {showAddModal && (
        <form onSubmit={handleAddSong} className="mt-3.5 pt-3 border-t border-[#333333] text-left space-y-2">
          <p className="text-[11px] text-[#b3b3b3] font-medium flex items-center gap-1">
            <LinkIcon className="w-3 h-3" /> ใส่ลิงก์ YouTube เพลงที่อยากให้เธอฟัง:
          </p>
          <input
            type="text"
            placeholder="ชื่อเพลง (เช่น เพลงของเรา)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full text-xs px-3 py-1.5 bg-[#242424] rounded-lg border border-[#444444] focus:outline-none focus:ring-1 focus:ring-[#1ed760] text-white"
          />
          <label className="block text-[11px] text-[#b3b3b3]" htmlFor="new-song-lyrics">
            เนื้อเพลงหรือข้อความสำหรับสุ่ม (หนึ่งท่อนต่อบรรทัด)
          </label>
          <textarea
            id="new-song-lyrics"
            placeholder="วางหรือพิมพ์ข้อความเพลง"
            value={newLyrics}
            onChange={(e) => setNewLyrics(e.target.value)}
            rows={3}
            className="w-full resize-y text-xs px-3 py-1.5 bg-[#242424] rounded-lg border border-[#444444] focus:outline-none focus:ring-1 focus:ring-[#1ed760] text-white"
          />

          <input
            type="text"
            placeholder="วางลิงก์ YouTube (https://youtu.be/...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            required
            className="w-full text-xs px-3 py-1.5 bg-[#242424] rounded-lg border border-[#444444] focus:outline-none focus:ring-1 focus:ring-[#1ed760] text-white"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-xs px-2.5 py-1 text-[#b3b3b3] hover:text-white active:scale-95"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!storageReady}
              className="text-xs px-3 py-1 bg-[#1ed760] hover:bg-[#1fdf64] text-black rounded-lg shadow-xs font-semibold active:scale-95"
            >
              เพิ่มและเล่นเพลง
            </button>
          </div>
        </form>
      )}

      {/* YouTube IFrame ซ่อนอยู่เบื้องหลังเพื่อเล่นเพลง */}
      <div className="absolute -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-1 h-1 overflow-hidden" aria-hidden="true">
        <div id="yt-audio-player" />
      </div>

      {/* รองรับไฟล์เสียง direct mp3 ปกติ */}
      <audio
        ref={audioRef}
        onEnded={nextSong}
      />
    </div>
  );
}