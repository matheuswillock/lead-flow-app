import { PublicScheduleShareContextProvider } from "./features/context/PublicScheduleShareContext";
import { PublicScheduleShareContainer } from "./features/container/PublicScheduleShareContainer";

export default async function PublicScheduleSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <PublicScheduleShareContextProvider token={token}>
      <PublicScheduleShareContainer />
    </PublicScheduleShareContextProvider>
  );
}
