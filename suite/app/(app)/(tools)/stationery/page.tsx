import type { Metadata } from "next";
import { StationeryApp } from "./StationeryClient";

export const metadata: Metadata = {
  title: "Stationery",
  description: "Print-ready place cards, table signs, seating boards and the order of service booklet, from the seating plan and the ceremony themselves.",
};

export default function StationeryPage() {
  return <StationeryApp />;
}
