import { PlayerScreen } from "./PlayerScreen";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ code?: string }>;
};

export default async function PlaySessionPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  const { code } = await searchParams;

  // The participant identity lives in sessionStorage on the device, so it is
  // read client-side. Passing it through the URL would put a credential in
  // browser history and any shared link.
  return <PlayerScreen sessionId={sessionId} joinCode={code ?? ""} />;
}
