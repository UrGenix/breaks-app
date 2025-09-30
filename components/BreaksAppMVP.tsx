"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ========== Types ========== */
type Day = "Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"|"Saturday"|"Sunday";
type Block = { id: string; name: string; day: Day; start: string; end: string };

/* ========== Helpers ========== */
const DAYS: Day[] = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const dayIdx = Object.fromEntries(DAYS.map((d, i) => [d, i])) as Record<Day, number>;
const uid = () => Math.random().toString(36).slice(2, 9);
const parseHHMM = (s: string) => { const [h, m] = s.split(":").map(Number); return (h * 60 + m) | 0; };
const fmt = (mins: number) => `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;

const mergeIntervals = (ivals: [number, number][]) => {
  const a = [...ivals].sort((x,y)=>x[0]-y[0] || x[1]-y[1]);
  const out: [number, number][] = [];
  for (const iv of a) {
    if (!out.length || iv[0] > out[out.length-1][1]) out.push([iv[0], iv[1]]);
    else if (iv[1] > out[out.length-1][1]) out[out.length-1][1] = iv[1];
  }
  return out;
};
const gapsBetween = (ivals:[number,number][]) => {
  const m = mergeIntervals(ivals), gaps: [number,number][] = [];
  for (let i=0;i<m.length-1;i++){ const a=m[i], b=m[i+1]; if (a[1] < b[0]) gaps.push([a[1], b[0]]); }
  return gaps;
};

// CSV
const toCSV = (blocks: Block[]) =>
  ["Name,Day,Start,End", ...blocks.map(b=>[b.name,b.day,b.start,b.end].join(","))].join("\n");

const fromCSV = (text: string) => {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.slice(1);
  const out: Block[] = [];
  for (const row of rows) {
    const [name, day, start, end] = row.split(",").map(s=>s?.trim());
    if (!name || !day || !start || !end) continue;
    if (!DAYS.includes(day as Day)) continue;
    out.push({ id: uid(), name, day: day as Day, start, end });
  }
  return out;
};

const LS_KEY = "breaks-mvp-blocks";

/* ========== UI Primitives ========== */
function Card({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/20 bg-white/80 backdrop-blur shadow-sm dark:bg-slate-900/70 dark:border-white/10 ${className}`}>
      {children}
    </div>
  );
}
function Section({ title, icon, children, defaultOpen=false }: { title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="rounded-2xl overflow-hidden" open={defaultOpen}>
      <summary className="list-none">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/80 dark:bg-slate-900/70 backdrop-blur border-b border-white/20 dark:border-white/10">
          <span className="text-xl">{icon}</span>
          <h3 className="font-semibold text-base">{title}</h3>
          <span className="ml-auto text-slate-500 dark:text-slate-400">▾</span>
        </div>
      </summary>
      <div className="p-4 bg-white/70 dark:bg-slate-900/60">{children}</div>
    </details>
  );
}
function BigButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={
        "h-12 rounded-2xl text-base font-medium px-4 bg-indigo-600 text-white active:scale-[0.99] shadow disabled:opacity-50 disabled:cursor-not-allowed " +
        (className || "")
      }
    />
  );
}

/* ========== Main App ========== */
export default function BreaksAppMVP() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [name, setName] = useState("");
  const [day, setDay] = useState<Day>("Monday");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:10");

  const [queryName, setQueryName] = useState("");
  const [queryDay, setQueryDay] = useState<Day>(DAYS[new Date().getDay()-1] || "Monday");
  const [queryTime, setQueryTime] = useState(()=>{
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  });

  // load/save localStorage
  useEffect(()=>{
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setBlocks(JSON.parse(raw)); } catch {}
  },[]);
  useEffect(()=>{
    try { localStorage.setItem(LS_KEY, JSON.stringify(blocks)); } catch {}
  },[blocks]);

  const people = useMemo(()=> Array.from(new Set(blocks.map(b=>b.name))).sort(), [blocks]);

  // intervals by person/day (merged)
  const byPersonDay = useMemo(()=>{
    const map = new Map<string, [number,number][]>();
    for (const b of blocks) {
      const key = `${b.name}__${b.day}`;
      const arr = map.get(key) || [];
      arr.push([parseHHMM(b.start), parseHHMM(b.end)]);
      map.set(key, arr);
    }
    for (const [k, arr] of map) map.set(k, mergeIntervals(arr));
    return map;
  }, [blocks]);

  // actions
  function addBlock(){
    if (!name.trim()) return;
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return;
    const s = parseHHMM(start), e = parseHHMM(end);
    if (e <= s) return;
    setBlocks(prev => [...prev, { id: uid(), name: name.trim(), day, start, end }].sort((a,b)=>
      a.name.localeCompare(b.name) || dayIdx[a.day]-dayIdx[b.day] || parseHHMM(a.start)-parseHHMM(b.start)
    ));
    setStart("09:00"); setEnd("10:10"); // quick reset for mobile flow
  }
  function deleteBlock(id: string){ setBlocks(prev => prev.filter(b=>b.id!==id)); }
  function clearAll(){ if (confirm("Clear all blocks?")) setBlocks([]); }

  // computed queries
  const freeAt = (dayQ: Day, timeQ: string) => {
    const t = parseHHMM(timeQ);
    const everyone = new Set(blocks.map(b=>b.name));
    const busy = new Set<string>();
    for (const b of blocks) {
      if (b.day !== dayQ) continue;
      const s = parseHHMM(b.start), e = parseHHMM(b.end);
      if (s <= t && t < e) busy.add(b.name);
    }
    return [...everyone].filter(n=>!busy.has(n)).sort();
  };
  const personBreaksToday = (nameQ: string, dayQ: Day) => {
    const key = `${nameQ}__${dayQ}`;
    const ivals = byPersonDay.get(key) || [];
    return gapsBetween(ivals);
  };

  // CSV
  const fileRef = useRef<HTMLInputElement>(null);
  function downloadCSV(){
    const csv = toCSV(blocks);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "timetable.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  function onCSVFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const text = String(reader.result || "");
      const toAdd = fromCSV(text);
      setBlocks(prev => [...prev, ...toAdd].sort((a,b)=>
        a.name.localeCompare(b.name) || dayIdx[a.day]-dayIdx[b.day] || parseHHMM(a.start)-parseHHMM(b.start)
      ));
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(f);
  }

  /* --- Section refs + navigator --- */
  const addRef = useRef<HTMLDivElement>(null);
  const freeRef = useRef<HTMLDivElement>(null);
  const peopleRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement>(null);

  function goTo(ref: React.RefObject<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const details = el.querySelector("details") as HTMLDetailsElement | null;
    if (details) details.open = true; // auto-open accordion
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-svh bg-gradient-to-b from-indigo-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/70 backdrop-blur border-b border-white/20 dark:border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="size-9 rounded-xl bg-indigo-600 text-white grid place-items-center text-sm">B</div>
          <div className="mr-auto">
            <div className="font-semibold">Breaks</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Who’s free & when</div>
          </div>
          <label className="text-sm px-3 py-2 rounded-2xl border bg-white/70 dark:bg-slate-900/40 cursor-pointer">
            Import CSV
            <input ref={fileRef} type="file" accept=".csv" onChange={onCSVFile} className="hidden" />
          </label>
          <button onClick={downloadCSV} className="text-sm px-3 py-2 rounded-2xl border bg-white/70 dark:bg-slate-900/40">Export</button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-4 grid gap-4 pb-24">
        {/* Add block */}
        <div ref={addRef}>
          <Card className="p-4">
            <Section title="Add lesson block" icon="➕" defaultOpen>
              <div className="grid grid-cols-1 gap-3">
                <input
                  value={name} onChange={e=>setName(e.target.value)}
                  placeholder="Name (e.g. Niyam)" inputMode="text"
                  className="h-12 px-4 rounded-2xl border bg-white/80 dark:bg-slate-900/40"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={day} onChange={e=>setDay(e.target.value as Day)}
                    className="h-12 px-4 rounded-2xl border bg-white/80 dark:bg-slate-900/40"
                  >
                    {DAYS.map(d=> <option key={d} value={d}>{d}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={start} onChange={e=>setStart(e.target.value)} type="time" className="h-12 px-4 rounded-2xl border bg-white/80 dark:bg-slate-900/40" />
                    <input value={end} onChange={e=>setEnd(e.target.value)} type="time" className="h-12 px-4 rounded-2xl border bg-white/80 dark:bg-slate-900/40" />
                  </div>
                </div>
                <BigButton onClick={addBlock}>Add block</BigButton>
                <button onClick={clearAll} className="h-12 rounded-2xl border bg-white/60 dark:bg-slate-900/40">Clear all</button>
              </div>
            </Section>
          </Card>
        </div>

        {/* Who's free */}
        <div ref={freeRef}>
          <Card className="p-0">
            <Section title="Who’s free now?" icon="🕒" defaultOpen>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <select
                  value={queryDay} onChange={e=>setQueryDay(e.target.value as Day)}
                  className="h-12 px-4 rounded-2xl border bg-white/80 dark:bg-slate-900/40 col-span-1"
                >
                  {DAYS.map(d=> <option key={d} value={d}>{d}</option>)}
                </select>
                <input value={queryTime} onChange={e=>setQueryTime(e.target.value)} type="time" className="h-12 px-4 rounded-2xl border bg-white/80 dark:bg-slate-900/40" />
              </div>
              <ul className="grid gap-2">
                {freeAt(queryDay, queryTime).map(n => (
                  <li key={n} className="px-3 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/70">{n}</li>
                ))}
                {!freeAt(queryDay, queryTime).length && <li className="text-sm text-slate-500">No one free.</li>}
              </ul>
            </Section>
          </Card>
        </div>

        {/* Breaks for a person */}
        <div ref={peopleRef}>
          <Card className="p-0">
            <Section title="Breaks for a person" icon="☕">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <select
                  value={queryName} onChange={e=>setQueryName(e.target.value)}
                  className="h-12 px-4 rounded-2xl border bg-white/80 dark:bg-slate-900/40 col-span-2"
                >
                  <option value="">Select person</option>
                  {people.map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {!queryName && <p className="text-sm text-slate-500">Pick a name to see their breaks.</p>}
              {!!queryName && (
                <ul className="grid gap-2">
                  {personBreaksToday(queryName, queryDay).map(([s,e], i) => {
                    const mins = e - s; const h = Math.floor(mins/60), m = mins%60;
                    const dur = h ? `${h}h ${m}m` : `${m} mins`;
                    return (
                      <li key={i} className="px-3 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/70">
                        {fmt(s)}–{fmt(e)} <span className="text-slate-500">({dur})</span>
                      </li>
                    );
                  })}
                  {!personBreaksToday(queryName, queryDay).length && <li className="text-sm text-slate-500">No breaks today.</li>}
                </ul>
              )}
            </Section>
          </Card>
        </div>

        {/* All blocks */}
        <div ref={blocksRef}>
          <Card className="p-0">
            <Section title="All lesson blocks" icon="📋">
              {/* Mobile: cards */}
              <div className="grid gap-2 md:hidden">
                {[...blocks].sort((a,b)=>
                  a.name.localeCompare(b.name) || dayIdx[a.day]-dayIdx[b.day] || parseHHMM(a.start)-parseHHMM(b.start)
                ).map(b=>(
                  <div key={b.id} className="rounded-xl border bg-white/80 dark:bg-slate-900/50 p-3 flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-slate-500">{b.day} • {b.start}–{b.end}</div>
                    </div>
                    <button onClick={()=>deleteBlock(b.id)} className="ml-auto px-3 h-9 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-200">Delete</button>
                  </div>
                ))}
                {!blocks.length && <p className="text-sm text-slate-500">No blocks yet. Add some above or import CSV.</p>}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-white/20 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-slate-100 dark:bg-slate-800">
                      <th className="p-2">Name</th>
                      <th className="p-2">Day</th>
                      <th className="p-2">Start</th>
                      <th className="p-2">End</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...blocks].sort((a,b)=>
                      a.name.localeCompare(b.name) || dayIdx[a.day]-dayIdx[b.day] || parseHHMM(a.start)-parseHHMM(b.start)
                    ).map(b=>(
                      <tr key={b.id} className="border-t border-white/10">
                        <td className="p-2">{b.name}</td>
                        <td className="p-2">{b.day}</td>
                        <td className="p-2">{b.start}</td>
                        <td className="p-2">{b.end}</td>
                        <td className="p-2 text-right">
                          <button onClick={()=>deleteBlock(b.id)} className="px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-200">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </Card>
        </div>
      </main>

      {/* Bottom Nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/80 backdrop-blur border-t border-white/20 dark:border-white/10">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="h-14 text-sm flex flex-col items-center justify-center gap-1"
          >
            🏠<span>Top</span>
          </button>
          <button
            onClick={() => goTo(addRef)}
            className="h-14 text-sm flex flex-col items-center justify-center gap-1 text-indigo-600"
          >
            ➕<span>Add</span>
          </button>
          <button
            onClick={() => goTo(peopleRef)}
            className="h-14 text-sm flex flex-col items-center justify-center gap-1"
          >
            👥<span>People</span>
          </button>
          <button
            onClick={() => goTo(blocksRef)}
            className="h-14 text-sm flex flex-col items-center justify-center gap-1"
          >
            📋<span>Blocks</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
