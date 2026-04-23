import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { TodayClient } from "./today-client";

export default async function TodayPage() {
  const queryClient = new QueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodayClient />
    </HydrationBoundary>
  );
}
