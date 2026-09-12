import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type AppRole = "admin" | "employee";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function homeForRole(role: AppRole | null) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "employee") return "/employee/schedule";
  return "/login";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublicPath(pathname)) return supabaseResponse;

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Sesión activa: obtenemos el rol desde la tabla `profiles`.
  // Ajusta el nombre de la tabla/columnas a tu esquema real si difiere.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as AppRole | undefined) ?? null;

  if (isPublicPath(pathname) || pathname === "/") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = homeForRole(role);
    return NextResponse.redirect(homeUrl);
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = homeForRole(role);
    return NextResponse.redirect(homeUrl);
  }

  if (pathname.startsWith("/employee") && role !== "employee") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = homeForRole(role);
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}
