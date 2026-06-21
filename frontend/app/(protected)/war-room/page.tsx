import type { Metadata } from "next";
import { Questionnaire } from "@/components/war-room/questionnaire";

export const metadata: Metadata = {
  title: "War Room",
  description: "Stress-test your startup idea against three AI advisors in a structured debate. Surface hidden assumptions before you ship.",
  robots: { index: true, follow: true },
};

const WarRoomPage = () => <Questionnaire />;
export default WarRoomPage;
