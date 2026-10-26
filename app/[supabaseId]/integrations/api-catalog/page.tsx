import { ApiCatalogProvider } from "./features/context/ApiCatalogContext";
import { ApiCatalogContainer } from "./features/container/ApiCatalogContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function ApiCatalogPage({ params }: PageProps) {
  const { supabaseId } = await params;

  return (
    <ApiCatalogProvider supabaseId={supabaseId}>
      <ApiCatalogContainer />
    </ApiCatalogProvider>
  );
}
