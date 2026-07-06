import { MovieJobPage } from "@/components/MovieJobPage";

type MoviePageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function MoviePage({ params }: MoviePageProps) {
  const { jobId } = await params;
  return <MovieJobPage jobId={jobId} />;
}
