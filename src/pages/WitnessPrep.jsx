import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function WitnessPrep() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to ExamBuilder
    navigate(createPageUrl("ExamBuilder"));
  }, [navigate]);

  return <div className="p-8 text-slate-400">Redirecting to Exam Builder...</div>;
}