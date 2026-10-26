import { PixelPageProvider } from "./features/context/PixelPageContext";
import { PixelPageContainer } from "./features/container/PixelPageContainer";

interface PageProps {
  params: Promise<{ supabaseId: string }>;
}

export default async function PixelPage({ params }: PageProps) {
  const { supabaseId } = await params;

  return (
    <PixelPageProvider supabaseId={supabaseId}>
      <PixelPageContainer />
    </PixelPageProvider>
  );
}
