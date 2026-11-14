import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/connexion", "/auth", "/cgu", "/bientot"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  // Mode « bientôt » : variable MAINTENANCE=on sur l'hébergeur. Seul l'administrateur voit le site.
  if (process.env.MAINTENANCE === "on" && !["/bientot", "/connexion", "/auth/callback", "/cgu"].some((p) => path.startsWith(p))) {
    const { data: admin } = user ? await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle() : { data: null };
    if (!admin) { const url = req.nextUrl.clone(); url.pathname = "/bientot"; url.search = ""; return NextResponse.rewrite(url); }
  }

  const isPublic = PUBLIC.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));
  if (!user && !isPublic) {
    const url = req.nextUrl.clone(); url.pathname = "/connexion"; url.searchParams.set("suite", path);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"] };
