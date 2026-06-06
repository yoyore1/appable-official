import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <>
      <Background />
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card-float p-7 reveal reveal-1">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Pick up right where you left off.
          </p>
          <div className="mt-6">
            <AuthForm mode="login" />
          </div>
        </div>
      </main>
    </>
  );
}
