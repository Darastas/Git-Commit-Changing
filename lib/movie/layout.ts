import type { MovieFile, RepoMovie } from "./repo-movie-types";

export type CityDistrictLayout = {
  path: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export type CityBuildingLayout = {
  path: string;
  label: string;
  directory: string;
  language: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  activityScore: number;
  sizeScore: number;
  status: MovieFile["status"];
};

export type CodeCityLayout = {
  width: number;
  height: number;
  districts: CityDistrictLayout[];
  buildings: CityBuildingLayout[];
};

const DISTRICT_COLORS = ["#17201e", "#1d1b16", "#151d24", "#21181c", "#182015", "#1f1f23"];

function districtLabel(path: string) {
  return path === "." ? "root" : path.split("/").pop() ?? path;
}

function groupFiles(files: MovieFile[]) {
  const map = new Map<string, MovieFile[]>();
  for (const file of files) {
    const bucket = map.get(file.directory) ?? [];
    bucket.push(file);
    map.set(file.directory, bucket);
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === ".") {
      return -1;
    }
    if (b === ".") {
      return 1;
    }
    return a.localeCompare(b);
  });
}

export function buildCodeCityLayout(movie: RepoMovie, width: number, height: number): CodeCityLayout {
  const activeFiles = Object.values(movie.files)
    .filter((file) => file.status === "active")
    .sort((a, b) => a.path.localeCompare(b.path));
  const grouped = groupFiles(activeFiles);
  const safeWidth = Math.max(320, width);
  const safeHeight = Math.max(260, height);
  const padding = 24;
  const gap = 16;
  const districtCount = Math.max(1, grouped.length);
  const columns = Math.ceil(Math.sqrt(districtCount * (safeWidth / safeHeight)));
  const rows = Math.ceil(districtCount / columns);
  const districtWidth = (safeWidth - padding * 2 - gap * (columns - 1)) / columns;
  const districtHeight = (safeHeight - padding * 2 - gap * (rows - 1)) / rows;
  const districts: CityDistrictLayout[] = [];
  const buildings: CityBuildingLayout[] = [];

  grouped.forEach(([directory, files], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + column * (districtWidth + gap);
    const y = padding + row * (districtHeight + gap);
    const district: CityDistrictLayout = {
      path: directory,
      label: districtLabel(directory),
      x,
      y,
      width: districtWidth,
      height: districtHeight,
      color: DISTRICT_COLORS[index % DISTRICT_COLORS.length]
    };
    districts.push(district);

    const innerPadding = 16;
    const labelSpace = 28;
    const fileCount = Math.max(1, files.length);
    const buildingColumns = Math.ceil(Math.sqrt(fileCount * (districtWidth / districtHeight)));
    const buildingRows = Math.ceil(fileCount / buildingColumns);
    const cellWidth = Math.max(18, (districtWidth - innerPadding * 2) / buildingColumns);
    const cellHeight = Math.max(28, (districtHeight - innerPadding * 2 - labelSpace) / buildingRows);

    files.forEach((file, fileIndex) => {
      const fileColumn = fileIndex % buildingColumns;
      const fileRow = Math.floor(fileIndex / buildingColumns);
      const footprint = Math.max(16, Math.min(42, cellWidth * (0.42 + file.sizeScore * 0.34)));
      const towerHeight = Math.max(
        34,
        Math.min(190, 30 + Math.pow(file.sizeScore, 0.72) * 132 + file.activityScore * 28)
      );
      const centerX = x + innerPadding + fileColumn * cellWidth + cellWidth / 2;
      const baseY = y + labelSpace + innerPadding + (fileRow + 1) * cellHeight - 4;

      buildings.push({
        path: file.path,
        label: file.name,
        directory,
        language: file.language,
        color: file.color,
        x: centerX - footprint / 2,
        y: baseY - towerHeight,
        width: footprint,
        height: towerHeight,
        activityScore: file.activityScore,
        sizeScore: file.sizeScore,
        status: file.status
      });
    });
  });

  return {
    width: safeWidth,
    height: safeHeight,
    districts,
    buildings
  };
}
