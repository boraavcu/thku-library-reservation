import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { getFrontendBaseUrl } from "@/lib/publicPaths";
import { beginLoginAttempt, clearLoginAttempts, clientIpFromRequest } from "@/lib/loginRateLimit";
import {
  banIsActive,
  buildMicrosoftProfileUpdate,
  hashPassword,
  normalizeEmail,
  projectSessionUser,
  temporaryPasswordStillValid,
  verifyPassword,
} from "@/lib/staffAuth.mjs";

let dummyHashPromise;
function dummyPasswordHash() {
  dummyHashPromise ||= hashPassword("not-a-user-password");
  return dummyHashPromise;
}

const STUDENT_EMAIL_REGEX = /^s(\d+)@stu\.thk\.edu\.tr$/i;

function extractStudentNumber(email) {
  const match = email?.match(STUDENT_EMAIL_REGEX);
  return match ? match[1] : null;
}

const DEMO_USERS = {
  "s250444902@stu.thk.edu.tr": {
    email: "s250444902@stu.thk.edu.tr",
    fullName: "Bora Avcu (Öğrenci 1)",
    studentNumber: "250444902",
    department: "Bilgisayar Mühendisliği",
    role: "STUDENT",
  },
  "demo.ogrenci2.x91@demo.local": {
    email: "demo.ogrenci2.x91@demo.local",
    fullName: "Ayşe Yılmaz (Demo Öğrenci 2)",
    studentNumber: "990000002",
    department: "Havacılık ve Uzay Mühendisliği",
    role: "STUDENT",
  },
  "demo.ogrenci3.k42@demo.local": {
    email: "demo.ogrenci3.k42@demo.local",
    fullName: "Mehmet Demir (Demo Öğrenci 3)",
    studentNumber: "990000003",
    department: "Yazılım Mühendisliği",
    role: "STUDENT",
  },
  "demo.ogrenci4.m18@demo.local": {
    email: "demo.ogrenci4.m18@demo.local",
    fullName: "Zeynep Kaya (Demo Öğrenci 4)",
    studentNumber: "990000004",
    department: "Elektrik-Elektronik Mühendisliği",
    role: "STUDENT",
  },
  "demo.ogrenci5.p77@demo.local": {
    email: "demo.ogrenci5.p77@demo.local",
    fullName: "Caner Aydın (Demo Öğrenci 5 - Sınırda)",
    studentNumber: "990000005",
    department: "Makine Mühendisliği",
    role: "STUDENT",
  },
  "demo.ogrenci6.r33@demo.local": {
    email: "demo.ogrenci6.r33@demo.local",
    fullName: "Elif Şahin (Demo Öğrenci 6)",
    studentNumber: "990000006",
    department: "Endüstri Mühendisliği",
    role: "STUDENT",
  },
  "demo.ogrenci7.t55@demo.local": {
    email: "demo.ogrenci7.t55@demo.local",
    fullName: "Burak Çelik (Demo Öğrenci 7)",
    studentNumber: "990000007",
    department: "Pilotaj",
    role: "STUDENT",
  },
  "gorevli.demo@demo.local": {
    email: "gorevli.demo@demo.local",
    fullName: "Kütüphane Görevlisi (Demo)",
    studentNumber: null,
    department: "Kütüphane ve Dokümantasyon",
    role: "LIBRARIAN",
  },
  "boraa-35@hotmail.com": {
    email: "boraa-35@hotmail.com",
    fullName: "Kütüphane Müdürü (Bora Avcu)",
    studentNumber: null,
    department: "Kütüphane ve Dokümantasyon Daire Bşk.",
    role: "ADMIN",
  },
  "bim.demo@demo.local": {
    email: "bim.demo@demo.local",
    fullName: "THKÜ Sistem Yöneticisi (BİM - Demo)",
    studentNumber: null,
    department: "Bilgi İşlem Müdürlüğü",
    role: "SUPER_ADMIN",
  },
};

export const authOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "placeholder-client-id",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "placeholder-secret",
      tenantId: process.env.AZURE_AD_TENANT_ID || "placeholder-tenant-id",
      authorization: {
        params: {
          scope: "openid profile email User.Read",
          prompt: "login",
        },
      },
    }),

    CredentialsProvider({
      id: "demo-login",
      name: "Demo Girişi",
      credentials: {
        email: { label: "Email", type: "text" },
      },
      async authorize(credentials) {
        if (process.env.ENABLE_DEMO_LOGIN === "false") {
          throw new Error("DemoDevreDisi");
        }
        const targetEmail = credentials?.email?.trim().toLowerCase();
        const selectedDemo = DEMO_USERS[targetEmail] || DEMO_USERS["s250444902@stu.thk.edu.tr"];

        try {
          const dbUser = await prisma.user.upsert({
            where: { email: selectedDemo.email },
            update: {
              role: selectedDemo.role,
              isActive: true,
              lastLoginAt: new Date(),
            },
            create: {
              email: selectedDemo.email,
              fullName: selectedDemo.fullName,
              studentNumber: selectedDemo.studentNumber,
              department: selectedDemo.department,
              role: selectedDemo.role,
              acceptedAgreementVersion: "v1.0",
              isActive: true,
              lastLoginAt: new Date(),
            },
          });

          if (!dbUser?.isActive) {
            throw new Error("GirisBasarisiz");
          }

          return {
            id: dbUser.id,
            name: dbUser.fullName,
            email: dbUser.email,
            image: dbUser.avatarUrl,
            role: dbUser.role,
            studentNumber: dbUser.studentNumber,
            acceptedAgreementVersion: dbUser.acceptedAgreementVersion,
          };
        } catch (error) {
          if (error?.message === "GirisBasarisiz" || error?.message === "DemoDevreDisi") {
            throw error;
          }
          console.error("Demo girişi veritabanı hatası:", error?.message || error);
          throw new Error("GirisServis");
        }
      },
    }),

    CredentialsProvider({
      id: "staff-login",
      name: "Kurumsal giriş",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials, req) {
        const email = normalizeEmail(credentials?.email || "");
        const password = String(credentials?.password || "");
        const ip = clientIpFromRequest(req);
        let attempt = { limited: false, buckets: [] };
        try {
          attempt = await beginLoginAttempt({ email, ip });
          if (attempt.limited) throw new Error("CokFazlaDeneme");
          if (!email || !password) throw new Error("GirisBasarisiz");

          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              isActive: true,
              isBanned: true,
              banUntil: true,
              passwordHash: true,
              mustChangePassword: true,
              tempPasswordExpiresAt: true,
            },
          });
          const matches = await verifyPassword(
            password,
            user?.passwordHash || (await dummyPasswordHash())
          );
          const allowed =
            Boolean(user?.passwordHash) &&
            matches &&
            user.isActive &&
            !banIsActive(user) &&
            temporaryPasswordStillValid(user);

          if (!allowed) throw new Error("GirisBasarisiz");

          await clearLoginAttempts(attempt.buckets);
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          if (error?.message === "CokFazlaDeneme" || error?.message === "GirisBasarisiz") {
            throw error;
          }
          console.error("Kurumsal giriş tamamlanamadı.");
          throw new Error("GirisServis");
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.email) {
        return false;
      }

      if (account?.provider === "demo-login" || account?.provider === "staff-login") {
        return true;
      }

      try {
        const studentNumber = extractStudentNumber(user.email);

        const saved = await prisma.user.upsert({
          where: { email: user.email },
          update: buildMicrosoftProfileUpdate({
            name: user.name,
            image: user.image,
            studentNumber,
          }),
          create: {
            email: user.email,
            fullName: user.name || "İsimsiz Kullanıcı",
            avatarUrl: user.image || null,
            studentNumber,
            role: "STUDENT",
            isActive: true,
            lastLoginAt: new Date(),
          },
          select: { isActive: true },
        });

        return saved.isActive;
      } catch (error) {
        console.error("❌ KRİTİK HATA (Veritabanı):", error);
        return false;
      }
    },

    async jwt({ token, user, trigger, session }) {
      const lookupEmail = user?.email || token?.email;

      if (lookupEmail) {
        let dbUser = await prisma.user.findUnique({
          where: { email: lookupEmail },
          select: {
            id: true,
            fullName: true,
            role: true,
            studentNumber: true,
            avatarUrl: true,
            acceptedAgreementVersion: true,
            penaltyPoints: true,
            isBanned: true,
            banUntil: true,
            banReason: true,
            isActive: true,
            mustChangePassword: true,
            sessionVersion: true,
          },
        });

        if (dbUser?.isBanned && dbUser.banUntil && new Date(dbUser.banUntil) <= new Date()) {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { isBanned: false, banUntil: null, banReason: null, penaltyPoints: 0 },
            select: {
              id: true,
              fullName: true,
              role: true,
              studentNumber: true,
              avatarUrl: true,
              acceptedAgreementVersion: true,
              penaltyPoints: true,
              isBanned: true,
              banUntil: true,
              banReason: true,
              isActive: true,
              mustChangePassword: true,
              sessionVersion: true,
            },
          });
          await prisma.penaltyHistory.updateMany({
            where: { userId: dbUser.id, isActive: true },
            data: { isActive: false },
          });
        }

        if (dbUser) {
          const activeNoShowCount = await prisma.penaltyHistory.count({
            where: {
              userId: dbUser.id,
              penaltyType: "NO_SHOW",
              isActive: true,
            },
          });

          token.userId = dbUser.id;
          token.name = dbUser.fullName;
          token.role = dbUser.role;
          token.studentNumber = dbUser.studentNumber;
          token.avatarUrl = dbUser.avatarUrl;
          token.acceptedAgreementVersion = dbUser.acceptedAgreementVersion;
          token.penaltyPoints = dbUser.penaltyPoints;
          token.noShowCount = activeNoShowCount;
          token.isBanned = dbUser.isBanned;
          token.banUntil = dbUser.banUntil ? dbUser.banUntil.toISOString() : null;
          token.banReason = dbUser.banReason;
          token.sessionRevoked = false;
          token.mustChangePassword = Boolean(dbUser.mustChangePassword);
          if (dbUser.isActive === false) {
            token.sessionRevoked = true;
            token.userId = null;
            token.role = null;
            token.mustChangePassword = false;
          } else if (
            typeof token.sessionVersion === "number" &&
            token.sessionVersion !== dbUser.sessionVersion
          ) {
            token.sessionRevoked = true;
            token.userId = null;
            token.role = null;
            token.mustChangePassword = false;
          } else {
            token.sessionVersion = dbUser.sessionVersion;
          }
        }

        delete token.picture;
        delete token.image;
        delete token.passwordHash;
        delete token.tempPasswordExpiresAt;
      }

      if (
        trigger === "update" &&
        session &&
        token.userId &&
        Object.prototype.hasOwnProperty.call(session, "acceptedAgreementVersion")
      ) {
        token.acceptedAgreementVersion = session.acceptedAgreementVersion;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, projectSessionUser(token));
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      const allowedFrontend = getFrontendBaseUrl();
      if (url.startsWith(allowedFrontend)) return url;
      if (url.startsWith("/")) return `${allowedFrontend}${url}`;
      if (url.startsWith(baseUrl)) return allowedFrontend;
      return allowedFrontend;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn:
      process.env.NODE_ENV === "production"
        ? "/randevu/"
        : `${process.env.FRONTEND_URL || "http://localhost:5173"}/randevu/`,
    error:
      process.env.NODE_ENV === "production"
        ? "/randevu/"
        : `${process.env.FRONTEND_URL || "http://localhost:5173"}/randevu/`,
  },
  secret: process.env.NEXTAUTH_SECRET,
  ...(process.env.NODE_ENV === "production"
    ? {
        cookies: {
          sessionToken: {
            name: "__Secure-next-auth.session-token",
            options: { httpOnly: true, sameSite: "lax", path: "/randevu", secure: true },
          },
          callbackUrl: {
            name: "__Secure-next-auth.callback-url",
            options: { httpOnly: true, sameSite: "lax", path: "/randevu", secure: true },
          },
          csrfToken: {
            name: "__Secure-next-auth.csrf-token",
            options: { httpOnly: true, sameSite: "lax", path: "/randevu", secure: true },
          },
          pkceCodeVerifier: {
            name: "__Secure-next-auth.pkce.code_verifier",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/randevu",
              secure: true,
              maxAge: 60 * 15,
            },
          },
          state: {
            name: "__Secure-next-auth.state",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/randevu",
              secure: true,
              maxAge: 60 * 15,
            },
          },
          nonce: {
            name: "__Secure-next-auth.nonce",
            options: { httpOnly: true, sameSite: "lax", path: "/randevu", secure: true },
          },
        },
      }
    : {}),
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
