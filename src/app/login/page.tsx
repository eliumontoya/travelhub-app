import Image from "next/image";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#2d081e] px-4 py-8 text-[#321426] sm:px-6">
      <div
        aria-hidden="true"
        data-testid="login-atmosphere"
        className="absolute inset-0 -z-10 overflow-hidden bg-[#25101b]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(122deg,#180d15_0%,#3c152d_39%,#9a4d43_68%,#f0bd79_100%)]" />
        <div className="absolute inset-y-0 left-0 hidden w-[31%] bg-[linear-gradient(90deg,rgba(13,10,14,0.82),rgba(39,16,28,0.48))] lg:block" />
        <div
          data-testid="login-office-scene"
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_55%,rgba(23,10,18,0.18)_55%,rgba(17,9,15,0.76)_100%)]"
        >
          <div className="absolute bottom-[18%] left-0 hidden h-[42%] w-[36%] rounded-tr-[7rem] bg-[linear-gradient(120deg,rgba(54,24,29,0.78),rgba(22,14,20,0.18))] shadow-[18px_-18px_42px_rgba(8,5,9,0.42)] lg:block" />
          <div className="absolute bottom-[-8%] left-[-8%] h-[30%] w-[64%] -rotate-6 bg-[linear-gradient(180deg,rgba(48,22,30,0.94),rgba(17,10,16,0.98))] shadow-[0_-18px_42px_rgba(8,5,9,0.35)]" />
          <div
            data-testid="login-sunset-skyline"
            className="absolute bottom-[23%] right-0 h-[19%] w-[70%] bg-[linear-gradient(90deg,transparent_0%,rgba(45,25,34,0.38)_10%,rgba(45,25,34,0.8)_10%,rgba(45,25,34,0.8)_17%,transparent_17%,transparent_24%,rgba(43,23,32,0.72)_24%,rgba(43,23,32,0.72)_34%,transparent_34%,transparent_42%,rgba(50,27,34,0.85)_42%,rgba(50,27,34,0.85)_55%,transparent_55%,transparent_64%,rgba(44,23,31,0.74)_64%,rgba(44,23,31,0.74)_77%,transparent_77%)] [clip-path:polygon(0_80%,8%_80%,8%_44%,15%_44%,15%_68%,24%_68%,24%_20%,32%_20%,32%_60%,43%_60%,43%_35%,50%_35%,50%_72%,60%_72%,60%_10%,68%_10%,68%_56%,78%_56%,78%_30%,88%_30%,88%_65%,100%_65%,100%_100%,0_100%)]"
          />
        </div>
        <div
          data-testid="login-window-grid"
          className="absolute inset-y-0 right-0 w-[64%] border-l-[10px] border-[#24151c]/50 bg-[linear-gradient(90deg,transparent_0%,transparent_31%,rgba(35,19,25,0.54)_31%,rgba(35,19,25,0.54)_33%,transparent_33%,transparent_66%,rgba(35,19,25,0.42)_66%,rgba(35,19,25,0.42)_68%,transparent_68%),linear-gradient(180deg,transparent_0%,transparent_47%,rgba(34,18,24,0.46)_47%,rgba(34,18,24,0.46)_49%,transparent_49%)]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_22%,rgba(255,231,185,0.32),transparent_24%),linear-gradient(90deg,rgba(23,10,19,0.38),transparent_54%)]" />
      </div>

      <section
        data-testid="login-panel"
        aria-label="TravelHub"
        className="w-full max-w-md rounded-2xl bg-white/90 p-6 shadow-[0_24px_70px_rgba(30,7,21,0.35)] backdrop-blur-md sm:p-9"
      >
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.jpeg"
            alt="TravelHub"
            width={182}
            height={128}
            priority
            className="h-28 w-auto object-contain sm:h-32"
          />
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        {!configured ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            Supabase no está configurado todavía. Sigue los pasos de{" "}
            <code className="font-mono">SUPABASE_SETUP.md</code> para habilitar el login. Mientras
            tanto, el dashboard es accesible sin autenticación con datos de prueba.
          </p>
        ) : (
          <form action={signIn} className="space-y-5">
            <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#4a1834]">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                required
                className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-[#321426] shadow-[inset_0_0_0_1px_rgba(91,23,62,0.18)] outline-none transition focus:shadow-[inset_0_0_0_2px_#7b1a50]"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#4a1834]">Contraseña</label>
              <input
                id="password"
                type="password"
                name="password"
                required
                className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-[#321426] shadow-[inset_0_0_0_1px_rgba(91,23,62,0.18)] outline-none transition focus:shadow-[inset_0_0_0_2px_#7b1a50]"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-[#731044] px-4 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(92,18,62,0.26)] transition hover:bg-[#5c123e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#731044]"
            >
              Entrar
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
