export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("id");

    if (!reservationId) {
      return NextResponse.json({ error: "Rezervasyon ID gerekli." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    }

    const isStaff = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(user.role);
    if (reservation.userId !== user.id && !isStaff) {
      return NextResponse.json({ error: "Bu rezervasyonu iptal etme yetkiniz yok." }, { status: 403 });
    }

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: isStaff ? "Görevli tarafından iptal edildi" : "Kullanıcı tarafından iptal edildi",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reservation cancel error:", error);
    return NextResponse.json({ error: "İptal işlemi başarısız." }, { status: 500 });
  }
}