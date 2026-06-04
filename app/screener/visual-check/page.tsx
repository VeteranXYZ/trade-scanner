import { notFound } from "next/navigation";
import { MtfScreenerVisualCheckPage } from "@/components/screener/MtfScreenerVisualCheckPage";

export default function ScreenerVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <MtfScreenerVisualCheckPage />;
}
