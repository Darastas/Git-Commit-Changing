"use client";

import { Languages } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "zh";

export const messages = {
  en: {
    active: "active",
    activity: "Activity",
    all: "All",
    analyzingChanges: "Analyzing file changes",
    additions: "add",
    buildingTrend: "Building trend movie",
    changedFiles: "Changed files",
    changes: "changes",
    colorTheme: "Color theme",
    commit: "Commit",
    commitTrail: "Commit trail",
    commits: "commits",
    copyFailed: "Copy failed",
    copyShareLink: "Copy share link",
    couldNotGenerate: "Could not generate movie",
    cumulativeCommits: "Cumulative commits",
    curveStyle: "Curve style",
    curveDash: "Dash",
    curveLinear: "Linear",
    curveSmooth: "Smooth",
    date: "Date",
    datesWithCommits: "dates with commits",
    deletions: "del",
    delta: "Delta",
    english: "EN",
    exportJson: "Export RepoMovie JSON",
    exportPng: "Export PNG snapshot",
    fetchingCommits: "Fetching commit details",
    fetchingRepo: "Fetching repository metadata",
    files: "files",
    generateRepoMovie: "Generate repo movie",
    jumpToCommit: "Jump to commit",
    jumpToEnd: "Jump to end",
    jumpToStart: "Jump to start",
    language: "Language",
    languageField: "Language",
    loadRepository: "Load a repository or play the sample movie.",
    movieReady: "Movie ready",
    movieTimeline: "Movie timeline",
    moreFiles: "more files",
    noCommitData: "No commit data available",
    of: "of",
    paths: "paths",
    pauseMovie: "Pause movie",
    playMovie: "Play movie",
    publicRepo: "Public GitHub repository",
    queued: "Queued",
    recordWebM: "Record HD WebM",
    repositoryFallback: "Repository evolution movie",
    selectFile: "Select a building to inspect a file.",
    serverOnly: "Server-only GitHub access. No token is exposed to the browser.",
    share: "Share",
    shareCopied: "Copied",
    shareLinkCopied: "Share link copied",
    sizeScore: "Size score",
    speed: "Playback speed",
    starScale: "stars scale",
    stars: "stars",
    statusAdded: "added",
    statusModified: "modified",
    statusRemoved: "removed",
    statusRenamed: "renamed",
    storingMovie: "Storing movie artifact",
    stop: "Stop",
    switchToChinese: "Switch to Chinese",
    switchToEnglish: "Switch to English",
    tagLine: "Turn commits into a live trend movie.",
    untitledCommit: "Untitled commit",
    unknownDate: "Unknown date",
    validating: "Validating repository",
    zh: "中文"
  },
  zh: {
    active: "活跃文件",
    activity: "活跃度",
    all: "全部",
    analyzingChanges: "正在分析文件变更",
    additions: "增",
    buildingTrend: "正在生成趋势电影",
    changedFiles: "变更文件",
    changes: "处变更",
    colorTheme: "颜色主题",
    commit: "提交",
    commitTrail: "提交轨迹",
    commits: "次提交",
    copyFailed: "复制失败",
    copyShareLink: "复制分享链接",
    couldNotGenerate: "无法生成电影",
    cumulativeCommits: "累计提交",
    curveStyle: "曲线样式",
    curveDash: "虚线",
    curveLinear: "直线",
    curveSmooth: "平滑",
    date: "日期",
    datesWithCommits: "有提交的日期",
    deletions: "删",
    delta: "增删",
    english: "EN",
    exportJson: "导出 RepoMovie JSON",
    exportPng: "导出 PNG 截图",
    fetchingCommits: "正在获取提交详情",
    fetchingRepo: "正在获取仓库信息",
    files: "个文件",
    generateRepoMovie: "生成仓库电影",
    jumpToCommit: "跳到提交",
    jumpToEnd: "跳到末尾",
    jumpToStart: "跳到开头",
    language: "语言",
    languageField: "语言",
    loadRepository: "加载仓库，或播放示例电影。",
    movieReady: "电影已就绪",
    movieTimeline: "电影时间线",
    moreFiles: "个更多文件",
    noCommitData: "暂无提交数据",
    of: "/",
    paths: "路径",
    pauseMovie: "暂停电影",
    playMovie: "播放电影",
    publicRepo: "公开 GitHub 仓库",
    queued: "已排队",
    recordWebM: "录制高清 WebM",
    repositoryFallback: "仓库演化电影",
    selectFile: "选择一栋建筑来查看文件。",
    serverOnly: "GitHub 访问仅在服务端执行，令牌不会暴露给浏览器。",
    share: "分享",
    shareCopied: "已复制",
    shareLinkCopied: "分享链接已复制",
    sizeScore: "规模分",
    speed: "播放速度",
    starScale: "星标刻度",
    stars: "星标",
    statusAdded: "新增",
    statusModified: "修改",
    statusRemoved: "删除",
    statusRenamed: "重命名",
    storingMovie: "正在保存电影产物",
    stop: "停止",
    switchToChinese: "切换到中文",
    switchToEnglish: "切换到英文",
    tagLine: "把提交历史变成实时趋势电影。",
    untitledCommit: "未命名提交",
    unknownDate: "未知日期",
    validating: "正在验证仓库",
    zh: "中文"
  }
} as const;

export type MessageKey = keyof typeof messages.en;

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: MessageKey) => string;
};

const fallbackContext: LanguageContextValue = {
  language: "en",
  setLanguage: () => undefined,
  t: (key) => messages.en[key]
};

const LanguageContext = createContext<LanguageContextValue>(fallbackContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => messages[language][key]
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage: AppLanguage = language === "en" ? "zh" : "en";

  return (
    <div role="group" aria-label={t("language")} className="inline-flex items-center gap-1 rounded-[0.35rem] border border-stone-700 bg-[#090b0a] p-1">
      <button
        type="button"
        aria-label={language === "en" ? t("switchToChinese") : t("switchToEnglish")}
        title={language === "en" ? t("switchToChinese") : t("switchToEnglish")}
        className="inline-flex h-7 items-center gap-1.5 rounded-[0.28rem] px-2 text-xs font-semibold text-stone-200 transition hover:bg-stone-800"
        onClick={() => setLanguage(nextLanguage)}
      >
        <Languages className="h-3.5 w-3.5" />
        {language === "en" ? t("zh") : t("english")}
      </button>
    </div>
  );
}
