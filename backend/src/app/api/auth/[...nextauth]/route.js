import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/db";

const STUDENT_EMAIL_REGEX = /^s(\d+)@stu\.thk\.edu\.tr$/i;

function extractStudentNumber(email) {
  const match = email?.match(STUDENT_EMAIL_REGEX);
  return match ? match[1] : null;
}

// Test İçin Demo Profilleri (7 Öğrenci + 3 Yetkili Rol)
const DEMO_USERS = {
  "s250444902@stu.thk.edu.tr": {
    email: "s250444902@stu.thk.edu.tr",
    fullName: "Bora Avcu (Öğrenci 1)",
    studentNumber: "250444902",
    department: "Bilgisayar Mühendisliği",
    role: "STUDENT",
  },
  "s250201903@stu.thk.edu.tr": {
    email: "s250201903@stu.thk.edu.tr",
    fullName: "Ayşe Yılmaz (Öğrenci 2)",
    studentNumber: "250201903",
    department: "Havacılık ve Uzay Mühendisliği",
    role: "STUDENT",
  },
  "s220401001@stu.thk.edu.tr": {
    email: "s220401001@stu.thk.edu.tr",
    fullName: "Mehmet Demir (Öğrenci 3)",
    studentNumber: "220401001",
    department: "Yazılım Mühendisliği",
    role: "STUDENT",
  },
  "s220401002@stu.thk.edu.tr": {
    email: "s220401002@stu.thk.edu.tr",
    fullName: "Zeynep Kaya (Öğrenci 4)",
    studentNumber: "220401002",
    department: "Elektrik-Elektronik Mühendisliği",
    role: "STUDENT",
  },
  "s220401003@stu.thk.edu.tr": {
    email: "s220401003@stu.thk.edu.tr",
    fullName: "Caner Aydın (Öğrenci 5)",
    studentNumber: "220401003",
    department: "Makine Mühendisliği",
    role: "STUDENT",
  },
  "s220401004@stu.thk.edu.tr": {
    email: "s220401004@stu.thk.edu.tr",
    fullName: "Elif Şahin (Öğrenci 6)",
    studentNumber: "220401004",
    department: "Endüstri Mühendisliği",
    role: "STUDENT",
  },
  "s220401005@stu.thk.edu.tr": {
    email: "s220401005@stu.thk.edu.tr",
    fullName: "Burak Çelik (Öğrenci 7)",
    studentNumber: "220401005",
    department: "Pilotaj",
    role: "STUDENT",
  },
  "kutuphane@thk.edu.tr": {
    email: "kutuphane@thk.edu.tr",
    fullName: "Kütüphane Görevlisi",
    studentNumber: null,
    department: "Kütüphane ve Dokümantasyon",
    role: "LIBRARIAN",
  },
  "mudur@thk.edu.tr": {
    email: "mudur@thk.edu.tr",
    fullName: "Kütüphane Müdürü (İdare)",
    studentNumber: null,
    department: "Kütüphane ve Dokümantasyon Daire Bşk.",
    role: "ADMIN",
  },
  "admin@thk.edu.tr": {
    email: "admin@thk.edu.tr",
    fullName: "THKÜ Sistem Yöneticisi (BİM)",
    studentNumber: null,
    department: "Bilgi İşlem Müdürlüğü",
    role: "SUPER_ADMIN",
  },
};

export const authOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    // 1. Kurumsal Microsoft Azure AD Girişi
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

    // 2. Sunum & Test İçin Geçici Demo Girişi
    CredentialsProvider({
      id: "demo-login",
      name: "Demo Girişi",
      credentials: {
        email: { label: "Email", type: "text" },
      },
      async authorize(credentials) {
        const targetEmail = credentials?.email?.trim().toLowerCase();
        const selectedDemo = DEMO_USERS[targetEmail] || DEMO_USERS["s220401001@stu.thk.edu.tr"];

        // Grup rezervasyonunda arkadaş davetinin (s220401002@stu.thk.edu.tr)
        // hata vermemesi için tüm demo kullanıcılarının DB'de var olduğundan emin ol
        for (const demo of Object.values(DEMO_USERS)) {
          await prisma.user.upsert({
            where: { email: demo.email },
            update: {
              fullName: demo.fullName,
              role: demo.role,
              department: demo.department,
              isActive: true,
            },
            create: {
              email: demo.email,
              fullName: demo.fullName,
              studentNumber: demo.studentNumber,
              department: demo.department,
              role: demo.role,
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
        console.error("❌ HATA: Kullanıcının emaili gelmedi!");
        return false;
      }

      // Demo girişi ise authorize() içinde zaten DB kaydı yapıldı
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
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: {
            id: true,
            fullName: true,
            role: true,
            studentNumber: true,
            avatarUrl: true,
            acceptedAgreementVersion: true,
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.name = dbUser.fullName;
          token.role = dbUser.role;
          token.studentNumber = dbUser.studentNumber;
          token.avatarUrl = dbUser.avatarUrl;
          token.acceptedAgreementVersion = dbUser.acceptedAgreementVersion;
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