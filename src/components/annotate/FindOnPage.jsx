import React, { useState, useEffect } from "react";
import { Search, ChevronDown, ChevronUp, X } from "lucide-react";

/**
 * Searches the text layer of a loaded pdfjs page object.
 * pdfPage: pdfjs page object (from pdfDoc.getPage(n))
 */
export default function FindOnPage({ pdfDoc, pageIndex }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ran, setRan] = useState(false);

  // Reset when page changes
  useEffect(() => {
    setResults([]);
    setRan(false);
    setCurrentIdx(0);
  }, [pageIndex]);

  const doSearch = async () => {
    if (!pdfDoc || !term.trim()) return;
    setSearching(true);
    setRan(true);
    try {
      const page = await pdfDoc.getPage(pageIndex);
      const tc = await page.getTextContent();
      const items = tc.items.map(item => item.str || "");
      const fullText = items.join(" ");

      const q = term.toLowerCase();
      const found = [];
      let idx = 0;
      while (idx < fullText.length) {
        const pos = fullText.toLowerCase().indexOf(q, idx);
        if (pos === -1) break;
        const start = Math.max(0, pos - 40);
        const end = Math.min(fullText.length, pos + q.length + 60);
        found.push({
          snippet: fullText.slice(start, end),
          matchStart: pos - start,
          matchLen: q.length,
        });
        idx = pos + q.length;
      }
      setResults(found);
      setCurrentIdx(0);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") doSearch();
  };

  const goNext = () => setCurrentIdx(i => Math.min(results.length - 1, i + 1));
  const goPrev = () => setCurrentIdx(i => Math.max(0, i - 1));

  return (
    <div className="border-t border-[#1e2a45] bg-[#0a0f1e]">
      {/* Search bar */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Search className="w-3 h-3 text-slate-500 flex-shrink-0" />
        <input
          value={term}
          onChange={e => { setTerm(e.target.value); setRan(false); }}
          onKeyDown={handleKey}
          placeholder="Find on page…"
          className="flex-1 bg-transparent text-[11px] text-slate-300 outline-none placeholder:text-slate-600"
        />
        {term && (
          <button onClick={() => { setTerm(""); setResults([]); setRan(false); }}
            className="text-slate-600 hover:text-slate-400"><X className="w-3 h-3" /></button>
        )}
        <button onClick={doSearch} disabled={!term.trim() || searching}
          className="px-1.5 py-0.5 text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/25 disabled:opacity-40">
          {searching ? "…" : "Find"}
        </button>
      </div>

      {/* Results */}
      {ran && (
        <div className="px-2 pb-2">
          {results.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic px-1">No matches found.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-slate-500">{results.length} match{results.length !== 1 ? "es" : ""}</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={goPrev} disabled={currentIdx === 0}
                    className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                  <span className="text-[9px] text-slate-500">{currentIdx + 1}/{results.length}</span>
                  <button onClick={goNext} disabled={currentIdx >= results.length - 1}
                    className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                </div>
              </div>
              {/* Current snippet */}
              {results[currentIdx] && (
                <SnippetRow snippet={results[currentIdx].snippet} matchStart={results[currentIdx].matchStart} matchLen={results[currentIdx].matchLen} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SnippetRow({ snippet, matchStart, matchLen }) {
  const before = snippet.slice(0, matchStart);
  const match = snippet.slice(matchStart, matchStart + matchLen);
  const after = snippet.slice(matchStart + matchLen);
  return (
    <div className="bg-[#0f1629] border border-[#1e2a45] rounded px-2 py-1.5 text-[10px] text-slate-400 leading-snug">
      <span className="text-slate-600">…{before}</span>
      <span className="text-yellow-300 font-semibold bg-yellow-400/10 rounded px-0.5">{match}</span>
      <span className="text-slate-600">{after}…</span>
    </div>
  );
}