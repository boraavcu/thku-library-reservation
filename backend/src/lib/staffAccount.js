import prisma from "@/lib/db";
import { deliverTempPasswordEmail } from "@/lib/staffMail";
import {
  STAFF_ROLES,
  TEMP_PASSWORD_TTL_MS,
  generateTempPassword,
  hashPassword,
  isExactThkStaffEmail,
  normalizeEmail,
} from "@/lib/staffAuth.mjs";

function failure(status, error) {
  return { ok: false, status, error };
}

export async function setStaffActive({ adminId, adminRole, targetUserId, isActive }) {
  if (!targetUserId) return failure(400, "Kullanıcı seçilmedi.");
  if (targetUserId === adminId) return failure(400, "Kendi hesabınızın durumunu değiştiremezsiniz.");

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true },
  });
  if (!target || target.role === "STUDENT") {
    return failure(404, "Yetkili hesap bulunamadı.");
  }
  const allowed =
    adminRole === "SUPER_ADMIN" || (adminRole === "ADMIN" && target.role === "LIBRARIAN");
  if (!allowed) return failure(403, "Bu hesabın durumunu değiştirme yetkiniz yok.");

  const active = Boolean(isActive);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { isActive: active, sessionVersion: { increment: 1 } },
    }),
    prisma.adminAction.create({
      data: {
        adminId,
        actionType: "BULK_OPERATION",
        targetEntityType: "User",
        targetEntityId: target.id,
        affectedUserId: target.id,
        description: `${target.email} hesabı ${active ? "aktif" : "pasif"} yapıldı. Pasif hesap giriş yapamaz.`,
        newData: { isActive: active },
      },
    }),
  ]);

  return { ok: true, status: 200 };
}

async function emailTaken(email) {
  const rows = await prisma.$queryRaw`
    SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1
  `;
  return rows.length > 0;
}

export async function createStaffAccount({ adminId, fullName, email, department, role, phone }) {
  const normalized = normalizeEmail(email);
  if (!isExactThkStaffEmail(normalized)) {
    if (/[ıİğĞüÜşŞöÖçÇ]/.test(email)) {
      return failure(400, "E-posta adresinde Türkçe karakter (ı, ğ, ü, ş, ö, ç) kullanılamaz. Lütfen standart İngilizce karakterler (ör. 'kullanici') kullanınız.");
    }
    return failure(400, "Yalnızca tam thk.edu.tr adresi kabul edilir. stu.thk.edu.tr ve diğer alt alan adları kullanılamaz.");
  }
  if (!STAFF_ROLES.includes(role)) {
    return failure(400, "Geçersiz rol.");
  }
  const name = String(fullName || "").trim();
  if (name.length < 2 || name.length > 255) {
    return failure(400, "Ad soyad 2 ile 255 karakter arasında olmalıdır.");
  }
  const dept = String(department || "").trim();
  if (dept.length > 100) {
    return failure(400, "Bölüm en fazla 100 karakter olabilir.");
  }
  const cleanPhone = phone ? String(phone).trim().slice(0, 20) : null;
  if (await emailTaken(normalized)) {
    return failure(409, "Bu e-posta adresi zaten kayıtlı. Yeni hesap açılmadı.");
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalized,
          fullName: name,
          department: dept || null,
          phone: cleanPhone,
          role,
          isActive: true,
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
          sessionVersion: 1,
        },
        select: { id: true, email: true, fullName: true, role: true, phone: true },
      });
      await tx.adminAction.create({
        data: {
          adminId,
          actionType: "USER_ACCOUNT_CREATED",
          targetEntityType: "User",
          targetEntityId: user.id,
          affectedUserId: user.id,
          description: `${user.email} için kurumsal hesap oluşturuldu. Rol: ${role}. Geçici şifre kayda yazılmadı.`,
          newData: { email: user.email, role, mustChangePassword: true },
        },
      });
      return user;
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return failure(409, "Bu e-posta adresi zaten kayıtlı. Yeni hesap açılmadı.");
    }
    console.error("Kurumsal hesap oluşturulamadı.");
    return failure(500, "Hesap oluşturulamadı.");
  }

  const emailDelivery = await deliverTempPasswordEmail({
    to: created.email,
    fullName: created.fullName,
    temporaryPassword,
    expiresAt,
  });

  return {
    ok: true,
    status: 201,
    account: created,
    temporaryPassword,
    expiresAt: expiresAt.toISOString(),
    emailDelivery,
  };
}

export async function resetStaffTempPassword({ adminId, targetUserId }) {
  if (!targetUserId) return failure(400, "Kullanıcı seçilmedi.");

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, fullName: true, passwordHash: true },
  });
  if (!target?.passwordHash) {
    return failure(404, "E-posta ve şifre ile giriş yapan hesap bulunamadı.");
  }
  if (!isExactThkStaffEmail(target.email)) {
    return failure(400, "Bu hesap kurumsal şifre yenileme kapsamının dışında.");
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.adminAction.create({
        data: {
          adminId,
          actionType: "TEMP_PASSWORD_RESET",
          targetEntityType: "User",
          targetEntityId: target.id,
          affectedUserId: target.id,
          description: `${target.email} için yeni geçici şifre üretildi. Eski şifreler ve oturumlar geçersiz kılındı. Geçici şifre kayda yazılmadı.`,
          newData: { email: target.email, mustChangePassword: true },
        },
      });
    });
  } catch {
    console.error("Geçici şifre yenilenemedi.");
    return failure(500, "Geçici şifre yenilenemedi.");
  }

  const emailDelivery = await deliverTempPasswordEmail({
    to: target.email,
    fullName: target.fullName,
    temporaryPassword,
    expiresAt,
  });

  return {
    ok: true,
    status: 200,
    account: { id: target.id, email: target.email, fullName: target.fullName },
    temporaryPassword,
    expiresAt: expiresAt.toISOString(),
    emailDelivery,
  };
}
