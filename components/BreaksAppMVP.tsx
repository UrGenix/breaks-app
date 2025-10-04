"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------------- Types ---------------- */
type Day = "Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"|"Saturday"|"Sunday";

type Block = {
  id: string;
  name: string;
  day: Day;
  start: string; // HH:MM
  end: string;   // HH:MM
  room: string;  // used for filters
};

/* --------------- Helpers --------------- */
const DAYS: Day[] = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const dayIdx: Record<Day, number> = Object.fromEntries(DAYS.map((d,i)=>[d,i])) as Record<Day, number>;

function parseHHMM(s: string): number { const [h,m] = s.split(":").map(Number); return (h*60+m)|0; }
function fmt(mins: number): string { const h=Math.floor(mins/60), m=mins%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
function uid(){ return Math.random().toString(36).slice(2,9); }

function mergeIntervals(intervals: [number, number][]): [number, number][] {
  const arr=[...intervals].sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const out:[number,number][]=[];
  for(const iv of arr){ if(!out.length||iv[0]>out[out.length-1][1]) out.push([iv[0],iv[1]]); else if(iv[1]>out[out.length-1][1]) out[out.length-1][1]=iv[1]; }
  return out;
}
function gapsBetween(intervals: [number, number][]): [number, number][] {
  const merged=mergeIntervals(intervals); const gaps:[number,number][]=[];
  for(let i=0;i<merged.length-1;i++){ const a=merged[i], b=merged[i+1]; if(a[1]<b[0]) gaps.push([a[1],b[0]]); }
  return gaps;
}
function getBuilding(room?: string): string {
  if (!room) return "";
  const first = room.trim()[0]?.toUpperCase() || "";
  return /^[A-Z]$/.test(first) ? first : "";
}

/* -------- CSV helpers (Name,Day,Start,End,Room) -------- */
function toCSV(blocks: Block[]): string {
  const header = "Name,Day,Start,End,Room";
  const lines = blocks.map(b => [b.name, b.day, b.start, b.end, (b.room||"")].join(","));
  return [header, ...lines].join("\n");
}
function fromCSV(text: string): Block[] {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map(h=>h.trim().toLowerCase());
  const idx = {
    name: header.indexOf("name"),
    day: header.indexOf("day"),
    start: header.indexOf("start"),
    end: header.indexOf("end"),
    room: header.indexOf("room"),
  };
  const rows = lines.slice(1);
  const out: Block[] = [];
  for (const row of rows) {
    const cols = row.split(",").map(s=>s?.trim() ?? "");
    const name = idx.name>=0? cols[idx.name] : "";
    const day = idx.day>=0? cols[idx.day] : "";
    const start = idx.start>=0? cols[idx.start] : "";
    const end = idx.end>=0? cols[idx.end] : "";
    const room = idx.room>=0? cols[idx.room] : "";
    if (!name || !day || !start || !end) continue;
    if (!DAYS.includes(day as Day)) continue;
    out.push({ id: uid(), name, day: day as Day, start, end, room });
  }
  return out;
}

/* --------------- Local storage --------------- */
const LS_KEY = "breaks-mvp-blocks@v3";
const THEME_KEY = "breaks-theme"; // "light" | "dark"

/* ----------- Theme hook (dark/light) ----------- */
function useTheme(){
  const [mode, setMode] = useState<"light"|"dark">("light");
  useEffect(()=>{
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial = (saved==="dark"||saved==="light") ? saved : (prefersDark? "dark":"light");
    setMode(initial);
    document.documentElement.classList.toggle("dark", initial==="dark");
  },[]);
  const toggle = ()=>{
    setMode(m=>{
      const next = m==="dark" ? "light":"dark";
      localStorage.setItem(THEME_KEY, next);
      document.documentElement.classList.toggle("dark", next==="dark");
      return next;
    });
  };
  return { mode, toggle };
}

/* ------------------- UI ------------------- */
export default function BreaksAppMVP(){
  const { mode, toggle } = useTheme();

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [name, setName] = useState("");
  const [day, setDay] = useState<Day>("Monday");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:10");
  const [room, setRoom] = useState("");

  const [queryDay, setQueryDay] = useState<Day>(DAYS[new Date().getDay()-1] || "Monday");
  const [queryTime, setQueryTime] = useState(()=>{
    const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  });
  const [roomFilter, setRoomFilter] = useState<string>("");
  const [buildingFilter, setBuildingFilter] = useState<string>("");

  // load/save
  useEffect(()=>{ try{ const raw=localStorage.getItem(LS_KEY); if(raw) setBlocks(JSON.parse(raw)); }catch{} },[]);
  useEffect(()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(blocks)); }catch{} },[blocks]);

  const people = useMemo(()=> Array.from(new Set(blocks.map(b=>b.name))).sort(), [blocks]);
  const rooms = useMemo(()=> ["", ...Array.from(new Set(blocks.map(b=>b.room).filter(Boolean))).sort()], [blocks]);
  const buildings = useMemo(()=> ["", ...Array.from(new Set(blocks.map(b=>getBuilding(b.room)).filter(Boolean))).sort()], [blocks]);

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

  function addBlock(){
    if(!name.trim()) return;
    if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)) return;
    const s=parseHHMM(start), e=parseHHMM(end); if(e<=s) return;
    setBlocks(prev => [...prev, { id: uid(), name: name.trim(), day, start, end, room: room.trim() }]
      .sort((a,b)=> a.name.localeCompare(b.name) || dayIdx[a.day]-dayIdx[b.day] || parseHHMM(a.start)-parseHHMM(b.start)));
    setRoom("");
  }
  function deleteBlock(id:string){ setBlocks(prev=>prev.filter(b=>b.id!==id)); }
  function clearAll(){ if(confirm("Clear all blocks?")) setBlocks([]); }

  // filters
  function personHasRoomToday(name: string, dayQ: Day, roomQ: string){
    if(!roomQ) return true;
    return blocks.some(b => b.name===name && b.day===dayQ && (b.room||"").toLowerCase()===roomQ.toLowerCase());
  }
  function personHasBuildingToday(name: string, dayQ: Day, buildingQ: string){
    if (!buildingQ) return true;
    return blocks.some(b => b.name===name && b.day===dayQ && getBuilding(b.room)===buildingQ);
  }

  // CSV
  const fileRef = useRef<HTMLInputElement>(null);
  function downloadCSV(){
    const csv = toCSV(blocks);
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="timetable.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  function onCSVFile(e: React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const text=String(reader.result||"");
      const toAdd=fromCSV(text);
      setBlocks(prev => [...prev, ...toAdd].sort((a,b)=>
        a.name.localeCompare(b.name) || dayIdx[a.day]-dayIdx[b.day] || parseHHMM(a.start)-parseHHMM(b.start)
      ));
      if (fileRef.current) fileRef.current.value="";
    };
    reader.readAsText(f);
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 grid gap-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Breaks App – MVP</h1>
          <div className="flex items-center gap-2">
            <button onClick={downloadCSV}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50
                         dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800">
              Export CSV
            </button>
            <label className="px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer
                               dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800">
              Import CSV
              <input ref={fileRef} type="file" accept=".csv" onChange={onCSVFile} className="hidden" />
            </label>
            <button onClick={clearAll}
              className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100
                         dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-900/60 dark:hover:bg-rose-900/50">
              Clear
            </button>

            {/* Theme toggle */}
            <button onClick={toggle}
              title={`Switch to ${mode==="dark"?"light":"dark"} mode`}
              className="ml-2 h-10 w-10 rounded-xl grid place-items-center border border-slate-200 bg-white hover:bg-slate-50
                         dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800">
              {mode==="dark" ? "🌞" : "🌙"}
            </button>
          </div>
        </header>

        {/* Add Block */}
        <section
          className="rounded-2xl border shadow-sm overflow-hidden
                     bg-gradient-to-br from-cyan-50 to-sky-50
                     dark:from-slate-900 dark:to-slate-900 dark:border-slate-800">
          <div className="p-4 border-b border-sky-100/70 dark:border-slate-800">
            <h2 className="font-semibold">Add lesson block</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"
                   className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800" />
            <select value={day} onChange={e=>setDay(e.target.value as Day)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
              {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <input value={start} onChange={e=>setStart(e.target.value)} type="time"
                   className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800" />
            <input value={end} onChange={e=>setEnd(e.target.value)} type="time"
                   className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800" />
            <input value={room} onChange={e=>setRoom(e.target.value)} placeholder="Room (e.g. E102)"
                   className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800" />
            <button onClick={addBlock}
              className="px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 transition-colors">
              Add
            </button>
          </div>
          <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400">Rooms are saved and included in CSV import/export.</p>
        </section>

        {/* Queries */}
        <section className="grid md:grid-cols-3 gap-6">
          {/* Who’s free? */}
          <div className="rounded-2xl border shadow-sm p-4 bg-white/80 backdrop-blur
                          dark:bg-slate-900/70 dark:border-slate-800">
            <h3 className="font-semibold mb-3">Who’s free?</h3>
            <div className="grid grid-cols-4 gap-2">
              <select value={queryDay} onChange={e=>setQueryDay(e.target.value as Day)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
              <input value={queryTime} onChange={e=>setQueryTime(e.target.value)} type="time"
                     className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800" />
              <select value={buildingFilter} onChange={e=>setBuildingFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                {buildings.map(b => <option key={b||"__all"} value={b}>{b? `${b} building` : "All buildings"}</option>)}
              </select>
              <select value={roomFilter} onChange={e=>setRoomFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                {rooms.map(r => <option key={r||"__all"} value={r}>{r? r : "All rooms"}</option>)}
              </select>
            </div>

            <FreeList
              blocks={blocks}
              day={queryDay}
              time={queryTime}
              roomFilter={roomFilter}
              buildingFilter={buildingFilter}
              roomCheck={(n,d,r)=>blocks.some(b=>b.name===n && b.day===d && (b.room||"").toLowerCase()===r.toLowerCase())}
              buildingCheck={(n,d,b)=>blocks.some(x=>x.name===n && x.day===d && getBuilding(x.room)===b)}
            />
          </div>

          {/* Breaks for a person */}
          <div className="rounded-2xl border shadow-sm p-4 bg-white/80 dark:bg-slate-900/70 dark:border-slate-800">
            <h3 className="font-semibold mb-3">Breaks for a person (today)</h3>
            <PersonBreaksPicker blocks={blocks} dayDefault={queryDay} />
          </div>

          {/* Common free */}
          <div className="rounded-2xl border shadow-sm p-4 bg-white/80 dark:bg-slate-900/70 dark:border-slate-800">
            <h3 className="font-semibold mb-3">Common free at time</h3>
            <CommonList day={queryDay} time={queryTime} names={[...new Set(blocks.map(b=>b.name))].sort()}
                        byPersonDay={byPersonDay} />
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl border shadow-sm p-4 bg-white/90 dark:bg-slate-900/70 dark:border-slate-800">
          <h2 className="font-semibold mb-3">All lesson blocks</h2>
          <BlocksTable blocks={blocks} onDelete={(id)=>deleteBlock(id)} />
        </section>
      </div>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */
function FreeList({
  blocks, day, time, roomFilter, buildingFilter, roomCheck, buildingCheck
}:{
  blocks: Block[];
  day: Day;
  time: string;
  roomFilter: string;
  buildingFilter: string;
  roomCheck: (name:string, day:Day, room:string)=>boolean;
  buildingCheck: (name:string, day:Day, building:string)=>boolean;
}){
  const t = parseHHMM(time);
  const everyone = useMemo(()=> Array.from(new Set(blocks.map(b=>b.name))).sort(), [blocks]);
  const busy = new Set<string>();

  for (const b of blocks) {
    if (b.day!==day) continue;
    const s = parseHHMM(b.start), e = parseHHMM(b.end);
    if (s <= t && t < e) busy.add(b.name);
  }

  let free = everyone.filter(n=>!busy.has(n));

  if (buildingFilter) free = free.filter(n => buildingCheck(n, day, buildingFilter));
  if (roomFilter) free = free.filter(n => roomCheck(n, day, roomFilter));

  // compute "next window" chip per person
  const nextInfo: Record<string, string> = {};
  for (const n of free) {
    const todays = blocks
      .filter(b=>b.name===n && b.day===day)
      .map(b=>({ s: parseHHMM(b.start), e: parseHHMM(b.end), room: b.room }))
      .sort((a,b)=>a.s-b.s);
    // find the first interval that starts after t
    const next = todays.find(iv => iv.s > t);
    if (next) nextInfo[n] = `next: ${fmt(next.s)} ${next.room || ""}`.trim();
    else nextInfo[n] = "free rest of day";
  }

  return (
    <ul className="text-sm grid gap-2">
      {free.length
        ? free.map(n=> (
            <li key={n} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-900
                                              dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <span>{n}</span>
              <span className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white/80
                               dark:border-slate-700 dark:bg-slate-900/60">
                {nextInfo[n]}
              </span>
            </li>
          ))
        : <li className="text-slate-500 dark:text-slate-400">No one</li>}
    </ul>
  );
}

function PersonBreaksPicker({ blocks, dayDefault }:{ blocks: Block[]; dayDefault: Day; }){
  const [who, setWho] = useState("");
  const [day, setDay] = useState<Day>(dayDefault);
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

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <select value={who} onChange={e=>setWho(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
          <option value="">Select person</option>
          {[...new Set(blocks.map(b=>b.name))].sort().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={day} onChange={e=>setDay(e.target.value as Day)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
          {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <BreaksList name={who} day={day} blocks={blocks} />
    </>
  );
}

function BreaksList({ name, day, blocks }:{ name:string; day:Day; blocks: Block[]; }){
  if(!name) return <p className="text-sm text-slate-500 dark:text-slate-400">Select a person</p>;
  const ivals = blocks.filter(b=>b.name===name && b.day===day).map(b=>[parseHHMM(b.start), parseHHMM(b.end)] as [number,number]);
  const gaps = gapsBetween(ivals);
  if(!gaps.length) return <p className="text-sm text-slate-500 dark:text-slate-400">No breaks</p>;
  return (
    <ul className="text-sm grid gap-2">
      {gaps.map(([s,e],i)=>{
        const mins=e-s, h=Math.floor(mins/60), m=mins%60;
        const dur= h? `${h}h ${m}m` : `${m} mins`;
        return <li key={i} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900
                                      dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
          {fmt(s)}–{fmt(e)} ({dur})
        </li>;
      })}
    </ul>
  );
}

function CommonList({ day, time, names, byPersonDay }:{
  day: Day; time: string; names: string[]; byPersonDay: Map<string,[number,number][]>;
}){
  const t=parseHHMM(time); const rows:{name:string,start:number,end:number}[]=[];
  for(const n of names){
    const key=`${n}__${day}`; const ivals=byPersonDay.get(key)||[];
    let busy=false; for(const [s,e] of ivals) if(s<=t && t<e){ busy=true; break; }
    if(busy) continue;
    if(!ivals.length){ rows.push({name:n,start:0,end:24*60-1}); continue; }
    let prevEnd: number | null=null, nextStart: number | null=null;
    for(const [s,e] of ivals){ if(e<=t) prevEnd=prevEnd==null? e : Math.max(prevEnd,e); if(s>t && nextStart==null) nextStart=s; }
    if(prevEnd!=null && nextStart!=null) rows.push({name:n,start:prevEnd,end:nextStart});
    else if(nextStart!=null) rows.push({name:n,start:0,end:nextStart});
    else if(prevEnd!=null) rows.push({name:n,start:prevEnd,end:24*60-1});
  }
  if(!rows.length) return <p className="text-sm text-slate-500 dark:text-slate-400">No one free</p>;
  return (
    <ul className="text-sm grid gap-2">
      {rows.map(r=>{
        const mins=r.end-r.start, h=Math.floor(mins/60), m=mins%60;
        const dur= h? `${h}h ${m}m` : `${m} mins`;
        return <li key={r.name} className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900
                                          dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
          <b>{r.name}</b> — {fmt(r.start)}–{fmt(r.end)} ({dur})
        </li>;
      })}
    </ul>
  );
}

function BlocksTable({ blocks, onDelete }:{ blocks: Block[]; onDelete:(id:string)=>void; }){
  const sorted = useMemo(()=>[...blocks].sort((a,b)=>
    a.name.localeCompare(b.name) || dayIdx[a.day]-dayIdx[b.day] || parseHHMM(a.start)-parseHHMM(b.start)
  ), [blocks]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left bg-sky-50/70 dark:bg-slate-800">
            <th className="p-2">Name</th>
            <th className="p-2">Day</th>
            <th className="p-2">Start</th>
            <th className="p-2">End</th>
            <th className="p-2">Room</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-sky-50/40 dark:[&>tr:nth-child(even)]:bg-slate-900/40">
          {sorted.map(b=>(
            <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="p-2">{b.name}</td>
              <td className="p-2">{b.day}</td>
              <td className="p-2">{b.start}</td>
              <td className="p-2">{b.end}</td>
              <td className="p-2">{b.room}</td>
              <td className="p-2 text-right">
                <button onClick={()=>onDelete(b.id)}
                        className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100
                                   dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sorted.length && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 p-2">No blocks yet. Add some above or import CSV.</p>}
    </div>
  );
}

