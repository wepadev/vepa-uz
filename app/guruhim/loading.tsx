import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <Spinner />
    </main>
  );
}
