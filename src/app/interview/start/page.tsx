import { Background } from "@/components/Background";
import { GuestNav } from "@/components/GuestNav";
import { InterviewStartClient } from "@/components/InterviewStartClient";

export default function InterviewStartPage() {
  return (
    <>
      <Background calm />
      <GuestNav />
      <main
        className="mx-auto flex max-w-2xl flex-col px-5 py-6"
        style={{ height: "calc(100vh - 64px)" }}
      >
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Let&apos;s build your app</h1>
          <p className="text-sm text-charcoal-soft">
            A few quick questions — answer like you&apos;re texting a friend.
          </p>
        </div>
        <div className="card-float flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <InterviewStartClient />
        </div>
      </main>
    </>
  );
}
