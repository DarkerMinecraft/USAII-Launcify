import type { Metadata } from "next";
import { auth0 } from "@/lib/auth0";
import { WarRoomArena } from "@/components/war-room/war-room-arena";
import { Button } from "@/components/ui/button";

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
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 text-center">
        <p className="font-serif italic mb-6 text-[26px] text-foreground">
          Sign in to enter the War Room.
        </p>
        <Button size="lg" className="text-[14.5px] rounded-[9px]" asChild>
          <a href="/auth/login">Sign in</a>
        </Button>
      </div>
    );
  }

  return <WarRoomArena id={id} />;
};
export default WarRoomSessionPage;
