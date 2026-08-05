import { scheduleShareUseCase } from "@/app/api/useCases/scheduleShare/ScheduleShareUseCase";
import { PublicScheduleShareContextProvider } from "./features/context/PublicScheduleShareContext";
import { PublicScheduleShareContainer } from "./features/container/PublicScheduleShareContainer";
import type { PublicScheduleShareData } from "./features/services/IPublicScheduleShareService";

export default async function PublicScheduleSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const output = await scheduleShareUseCase.getPublicShare(token);
  const initialData: PublicScheduleShareData | null =
    output.isValid && output.result ? (output.result as PublicScheduleShareData) : null;

  return (
    <PublicScheduleShareContextProvider token={token} initialData={initialData}>
      <PublicScheduleShareContainer />
    </PublicScheduleShareContextProvider>
  );
}
