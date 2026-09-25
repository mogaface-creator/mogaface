import { notFound } from "next/navigation";
import { CalibrationWorkbench } from "@/components/dev/CalibrationWorkbench";

// Development tool only: production builds render a 404 here. Nothing on this
// page is consumer-facing and no upload is stored.
export default function VisualCalibrationPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CalibrationWorkbench />;
}
