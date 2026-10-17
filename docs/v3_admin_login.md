🧩 THK Library System – Auth & Role Architecture (v1)
🎯 Amaç

Tek Azure AD login ile:

Normal kullanıcı (öğrenci/personel)
Admin / Librarian / Super Admin

rollerini yönetmek.

🌐 Domain Yapısı
library.thk.edu.tr        → USER PANEL
panel.library.thk.edu.tr  → ADMIN PANEL
🔐 Authentication
Provider: Azure AD (NextAuth)
Tüm loginler Azure üzerinden yapılır
Ayrı username/password yok
👤 User Lifecycle
1. İlk Login
onLogin(user):
    if user not exists in DB:
        create user with:
            role = "USER"
2. Super Admin Seed

DB ilk kurulumda:

INSERT INTO users (email, role)
VALUES ('admin@thk.edu.tr', 'SUPER_ADMIN');
3. Role Yönetimi

Roller:

USER
ADMIN
LIBRARIAN
SUPER_ADMIN
🔁 Routing Logic
📍 Login sonrası yönlendirme
if domain == "library.thk.edu.tr":
    redirect → /dashboard (user panel)

if domain == "panel.library.thk.edu.tr":
    if user.role in [ADMIN, LIBRARIAN, SUPER_ADMIN]:
        redirect → /admin
    else:
        redirect → https://library.thk.edu.tr
🧠 Access Control
Middleware (Next.js)
export function middleware(req) {
  const session = getSession(req);

  if (!session) {
    return redirect("/");
  }

  const role = session.user.role;
  const host = req.headers.get("host");

  // Admin domain kontrolü
  if (host.includes("panel.library.thk.edu.tr")) {
    if (!["ADMIN", "LIBRARIAN", "SUPER_ADMIN"].includes(role)) {
      return redirect("https://library.thk.edu.tr");
    }
  }

  return next();
}
🛠 Admin Panel Logic
Super Admin yetkisi
SUPER_ADMIN:
    - user list görür
    - role assign eder
    - admin ekler/siler
Role Atama
updateUserRole(userId, role):
    if currentUser.role != SUPER_ADMIN:
        throw "Unauthorized"

    update user set role = role
🧾 Agreement / Rules Flow
onLogin:
    if no active agreement:
        block access

    if user.acceptedAgreementVersion != agreement.version:
        redirect → /rules

    else:
        continue
🗄 Database Özet
User
id
email
role
acceptedAgreementVersion
isActive
Agreement
id
title
content
version
is_active
🔄 Sistem Akışı (Özet)
Azure Login
   ↓
User DB kontrol
   ↓
Role belirleme
   ↓
Domain'e göre yönlendirme
   ↓
Agreement kontrol
   ↓
Panel erişimi
🚀 Kısa Özet
Login tek → Azure
Ayrım → domain + role
Admin panel → sadece yetkililer
Super Admin → rol dağıtır
Kullanıcı admin paneli bilmez / erişemez
---------------------------
//

🔐 1. NextAuth + Azure AD + ROLE ENTEGRASYONU
📁 backend/src/app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const handler = NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      // İlk girişte user oluştur
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: user.email,
            role: "USER",
          },
        });
      }

      return true;
    },

    async jwt({ token }) {
      // DB’den rolü çek
      const dbUser = await prisma.user.findUnique({
        where: { email: token.email },
      });

      if (dbUser) {
        token.role = dbUser.role;
        token.userId = dbUser.id;
      }

      return token;
    },

    async session({ session, token }) {
      session.user.role = token.role;
      session.user.id = token.userId;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
🌐 2. MIDDLEWARE (DOMAIN + ROLE KONTROLÜ)
📁 backend/src/middleware.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  const token = await getToken({ req });
  const host = req.headers.get("host");

  // Login yoksa
  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const role = token.role;

  // ADMIN DOMAIN KONTROL
  if (host.includes("panel.library.thk.edu.tr")) {
    if (!["ADMIN", "LIBRARIAN", "SUPER_ADMIN"].includes(role)) {
      return NextResponse.redirect("https://library.thk.edu.tr");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
👑 3. SUPER ADMIN SEED (PRISMA)
📁 backend/prisma/seed.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@thk.edu.tr" },
    update: {},
    create: {
      email: "admin@thk.edu.tr",
      role: "SUPER_ADMIN",
    },
  });

  console.log("Super Admin hazır");
}

main();
Çalıştır:
node prisma/seed.js
🛠 4. ADMIN ROLE ATAMA API
📁 backend/src/app/api/admin/set-role/route.js
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";

const prisma = new PrismaClient();

export async function POST(req) {
  const session = await getServerSession();

  if (session.user.role !== "SUPER_ADMIN") {
    return new Response("Unauthorized", { status: 403 });
  }

  const { email, role } = await req.json();

  await prisma.user.update({
    where: { email },
    data: { role },
  });

  return Response.json({ success: true });
}
🖥 5. FRONTEND – ROLE BASED REDIRECT
📁 frontend/src/App.jsx (veya router)
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function App() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;

    const role = session.user.role;
    const host = window.location.host;

    if (host.includes("panel.library.thk.edu.tr")) {
      if (!["ADMIN", "LIBRARIAN", "SUPER_ADMIN"].includes(role)) {
        window.location.href = "https://library.thk.edu.tr";
      }
    }
  }, [session]);

  return <div>App</div>;
}
🧾 6. AGREEMENT KONTROL
📁 backend/src/app/api/agreements/active/route.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const agreement = await prisma.agreement.findFirst({
    where: { isActive: true },
  });

  if (!agreement) {
    return new Response("Not Found", { status: 404 });
  }

  return Response.json(agreement);
}
🧠 7. FULL FLOW
Azure Login
   ↓
User oluştur (ilk login)
   ↓
JWT içine role yaz
   ↓
Domain kontrol (middleware)
   ↓
Agreement kontrol
   ↓
Panel yönlendirme

//