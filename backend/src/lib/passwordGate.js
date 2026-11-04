import { NextResponse } from "next/server";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

export function noStoreJson(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export function rejectIfPasswordChangeRequired(session) {
  if (!session?.user?.mustChangePassword) return null;
  return noStoreJson(
    {
      error: "Devam etmek için önce kalıcı şifrenizi belirleyin.",
      code: "PASSWORD_CHANGE_REQUIRED",
    },
    403
  );
}
