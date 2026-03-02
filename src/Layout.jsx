import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard, Users, Target, FileText,
  BookOpen, List, Upload, Download, Settings, ChevronLeft, Menu, Video, Layers, GitBranch, Gavel, Monitor
} from "lucide-react";
import FloatingChat from "@/components/chat/FloatingChat";
import useActiveCase from "@/components/hooks/useActiveCase";

const NAV_SECTIONS = [
  {
    label: "CORE PIPELINE",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
      { name: "Parties", icon: Users, page: "Parties" },
      { name: "Trial Points", icon: Target, page: "TrialPoints" },
      { name: "Proof Vault", icon: Layers, page: "ProofLibrary" },
      { name: "Evidence Groups", icon: BookOpen, page: "ProofLibrary" },
      { name: "Exam Builder", icon: GitBranch, page: "ExamBuilder" },
    ],
  },
  {
    label: "LIVE TRIAL",
    items: [
      { name: "Attorney Cockpit", icon: Gavel, page: "AttorneyView" },
      { name: "Jury Screen", icon: Monitor, page: "JuryView" },
    ],
  },
  {
    label: "EXHIBITS",
    items: [
      { name: "Depo Exhibits", icon: BookOpen, page: "DepositionExhibits" },
      { name: "Extracts", icon: FileText, page: "Extracts" },
      { name: "Joint List", icon: List, page: "JointExhibits" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { name: "Import", icon: Upload, page: "Import" },
      { name: "Export", icon: Download, page: "Export" },
      { name: "Settings", icon: Settings, page: "SettingsPage" },
    ],
  },
];

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const { activeCase } = useActiveCase();

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      <style>{`
        :root {
          --bg-primary: #0a0f1e;
          --bg-secondary: #0f1629;
          --bg-card: #131a2e;
          --border-color: #1e2a45;
          --accent: #06b6d4;
          --accent-hover: #0891b2;
          --text-primary: #e2e8f0;
          --text-secondary: #cbd5e1;
          --plaintiff: #f59e0b;
          --defense: #ef4444;
          --independent: #8b5cf6;
        }
        * { scrollbar-width: thin; scrollbar-color: #1e2a45 transparent; }
      `}</style>

      {/* Sidebar */}
      <aside
        className={`${collapsed ? "w-16" : "w-56"} bg-[#0f1629] border-r border-[#1e2a45] flex flex-col transition-all duration-300 flex-shrink-0`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#1e2a45]">
          {!collapsed && <span className="text-sm font-bold tracking-wider text-cyan-400">PI TRIAL MAP</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white">
            {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {!collapsed && activeCase && (
          <div className="px-4 py-2 border-b border-[#1e2a45]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active Case</p>
            <p className="text-xs text-cyan-300 font-medium truncate">{activeCase.name}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-2">
              {!collapsed && (
                <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-2 border-transparent"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      <FloatingChat caseId={activeCase?.id} />
    </div>
  );
}