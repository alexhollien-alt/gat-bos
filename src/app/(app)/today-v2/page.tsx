import type { Metadata } from "next";
import { TodayV2Client } from "./today-v2-client";

export const metadata: Metadata = {
  title: "Today V2 · GAT-BOS",
};

export default function TodayV2Page() {
  return <TodayV2Client />;
}
