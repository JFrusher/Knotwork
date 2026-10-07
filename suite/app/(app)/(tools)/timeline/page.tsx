import type { Metadata } from "next";
import { TimelineApp } from "./TimelineClient";

export const metadata: Metadata = {
  title: "Timeline",
  description: "The run of the day, and what collides.",
};

export default function TimelinePage() {
  return <TimelineApp />;
}
