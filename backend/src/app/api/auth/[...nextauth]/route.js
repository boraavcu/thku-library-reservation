import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";

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
          throw new Error("Demo girişi canlı ortamda devre dışı bırakılmıştır.");
        }
        const targetEmail = credentials?.email?.trim().toLowerCase();
        const selectedDemo = DEMO_USERS[targetEmail] || DEMO_USERS["s250444902@stu.thk.edu.tr"];

        for (const demo of Object.values(DEMO_USERS)) {
          await prisma.user.upsert({
            where: { email: demo.email },
            update: {
              fullName: demo.fullName,
              department: demo.department,
              isActive: true,
            },
            create: {
              email: demo.email,
              fullName: demo.fullName,
              studentNumber: demo.studentNumber,
              department: demo.department,
              role: demo.role,
              acceptedAgreementVersion: "v1.0",
              isActive: true,
              lastLoginAt: new Date(),
            },
          });
        }

        const dbUser = await prisma.user.findUnique({
          where: { email: selectedDemo.email },
        });

        return {
          id: dbUser.id,
          name: dbUser.fullName,
          email: dbUser.email,
          image: dbUser.avatarUrl,
          role: dbUser.role,
          studentNumber: dbUser.studentNumber,
          acceptedAgreementVersion: dbUser.acceptedAgreementVersion,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.email) {
        return false;
      }

      if (account?.provider === "demo-login") {
        return true;
      }

      try {
        const studentNumber = extractStudentNumber(user.email);

        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            lastLoginAt: new Date(),
            avatarUrl: user.image || null,
            fullName: user.name || "İsimsiz Kullanıcı",
            ...(studentNumber && { studentNumber }),
          },
          create: {
            email: user.email,
            fullName: user.name || "İsimsiz Kullanıcı",
            avatarUrl: user.image || null,
            studentNumber,
            role: "STUDENT",
            isActive: true,
            lastLoginAt: new Date(),
          },
        });

        return true;
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
          },
        });

        // Süreli banın tarihi dolduysa otomatik olarak banı aç
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
        }

        delete token.picture;
        delete token.image;
      }

      if (trigger === "update" && session) {
        return { ...token, ...session };
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.name = token.name;
        session.user.role = token.role;
        session.user.studentNumber = token.studentNumber;
        session.user.image = token.avatarUrl;
        session.user.acceptedAgreementVersion = token.acceptedAgreementVersion;
        session.user.penaltyPoints = token.penaltyPoints ?? 0;
        session.user.noShowCount = token.noShowCount ?? 0;
        session.user.isBanned = Boolean(token.isBanned);
        session.user.banUntil = token.banUntil || null;
        session.user.banReason = token.banReason || null;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      const allowedFrontend = process.env.FRONTEND_URL || "http://localhost:5173";
      if (url.startsWith(allowedFrontend)) return url;
      if (url.startsWith("/")) return `${allowedFrontend}${url}`;
      return baseUrl;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };