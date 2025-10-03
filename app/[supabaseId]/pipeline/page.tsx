"use client"

import { PipelineProvider } from "./features/context/PipelineContext";
import { PipelineContainer } from "./features/container/PipelineContainer";

export default function Pipeline() {
  return (
    <PipelineProvider>
      <PipelineContainer />
    </PipelineProvider>
  );
}
