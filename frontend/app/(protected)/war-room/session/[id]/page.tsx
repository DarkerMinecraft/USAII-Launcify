import type { Metadata } from "next";
import { WarRoomArena } from "@/components/war-room/war-room-arena";

export const metadata: Metadata = {
  title: "War Room Session",
  robots: { index: false, follow: false },
};

const WarRoomSessionPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  return <WarRoomArena id={id} />;
};
export default WarRoomSessionPage;
