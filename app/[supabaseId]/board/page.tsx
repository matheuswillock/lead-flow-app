import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

type BoardPageProps = {
  params: Promise<{ supabaseId: string }>;
  searchParams?: Promise<SearchParams>;
};

function appendSearchParams(
  targetParams: URLSearchParams,
  sourceParams?: SearchParams
) {
  if (!sourceParams) return;

  Object.entries(sourceParams).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => targetParams.append(key, item));
      return;
    }
    targetParams.append(key, value);
  });
}

export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const { supabaseId } = await params;
  const resolvedSearchParams = await searchParams;

  const nextSearchParams = new URLSearchParams();
  appendSearchParams(nextSearchParams, resolvedSearchParams);
  nextSearchParams.set("view", "kanban");

  const query = nextSearchParams.toString();
  redirect(`/${supabaseId}/crm${query ? `?${query}` : ""}`);
}
