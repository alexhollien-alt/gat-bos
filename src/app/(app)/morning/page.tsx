import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { MorningClient } from "./morning-client";

export default async function MorningPage() {
  const queryClient = new QueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MorningClient />
    </HydrationBoundary>
  );
}
