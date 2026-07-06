export type MovieLanguage = {
  name: string;
  color: string;
};

const EXTENSION_LANGUAGES: Record<string, MovieLanguage> = {
  ".ts": { name: "TypeScript", color: "#3b82f6" },
  ".tsx": { name: "TypeScript", color: "#60a5fa" },
  ".js": { name: "JavaScript", color: "#facc15" },
  ".jsx": { name: "JavaScript", color: "#fde047" },
  ".json": { name: "JSON", color: "#a3e635" },
  ".css": { name: "CSS", color: "#22d3ee" },
  ".scss": { name: "CSS", color: "#f472b6" },
  ".html": { name: "HTML", color: "#fb923c" },
  ".md": { name: "Markdown", color: "#e5e7eb" },
  ".mdx": { name: "Markdown", color: "#d1d5db" },
  ".py": { name: "Python", color: "#10b981" },
  ".rb": { name: "Ruby", color: "#ef4444" },
  ".go": { name: "Go", color: "#06b6d4" },
  ".rs": { name: "Rust", color: "#f97316" },
  ".java": { name: "Java", color: "#f59e0b" },
  ".kt": { name: "Kotlin", color: "#c084fc" },
  ".swift": { name: "Swift", color: "#fb7185" },
  ".php": { name: "PHP", color: "#818cf8" },
  ".cs": { name: "C#", color: "#a78bfa" },
  ".cpp": { name: "C++", color: "#38bdf8" },
  ".c": { name: "C", color: "#67e8f9" },
  ".h": { name: "C/C++ Header", color: "#7dd3fc" },
  ".yml": { name: "YAML", color: "#fbbf24" },
  ".yaml": { name: "YAML", color: "#fbbf24" },
  ".toml": { name: "TOML", color: "#fcd34d" },
  ".sql": { name: "SQL", color: "#14b8a6" },
  ".sh": { name: "Shell", color: "#84cc16" },
  ".ps1": { name: "PowerShell", color: "#38bdf8" }
};

const BASENAME_LANGUAGES: Record<string, MovieLanguage> = {
  dockerfile: { name: "Docker", color: "#0ea5e9" },
  makefile: { name: "Makefile", color: "#94a3b8" },
  license: { name: "Text", color: "#cbd5e1" }
};

export function inferLanguage(path: string): MovieLanguage {
  const cleanPath = path.trim();
  const basename = cleanPath.split("/").pop()?.toLowerCase() ?? cleanPath.toLowerCase();

  if (BASENAME_LANGUAGES[basename]) {
    return BASENAME_LANGUAGES[basename];
  }

  const dotIndex = basename.lastIndexOf(".");
  if (dotIndex >= 0) {
    const extension = basename.slice(dotIndex);
    if (EXTENSION_LANGUAGES[extension]) {
      return EXTENSION_LANGUAGES[extension];
    }
  }

  return { name: "Other", color: "#94a3b8" };
}
