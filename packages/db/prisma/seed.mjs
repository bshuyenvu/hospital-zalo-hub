import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const departments = [
  ["BGD", "Ban Giám đốc"],
  ["TCHC", "Phòng Tổ chức - Hành chính"],
  ["KHTH", "Phòng Kế hoạch - Tổng hợp"],
  ["TCKT", "Phòng Tài chính - Kế toán"],
  ["DD", "Phòng Điều dưỡng"],
  ["CNTT", "Công nghệ thông tin"],
  ["KB", "Khoa Khám bệnh"],
  ["CC", "Khoa Cấp cứu"],
  ["HSTC", "Khoa Hồi sức tích cực & Chống độc"],
  ["NOI", "Khoa Nội tổng hợp"],
  ["NGOAI", "Khoa Ngoại tổng hợp"],
  ["SAN", "Khoa Sản"],
  ["NHI", "Khoa Nhi"],
  ["CDHA", "Khoa Chẩn đoán hình ảnh"],
  ["XN", "Khoa Xét nghiệm"],
  ["DUOC", "Khoa Dược"],
  ["KSNK", "Khoa Kiểm soát nhiễm khuẩn"]
];

async function main() {
  for (const [code, name] of departments) {
    await prisma.department.upsert({
      where: { code },
      update: { name, isActive: true },
      create: { code, name }
    });
  }

  const adminDepartment = await prisma.department.findUnique({
    where: { code: "BGD" }
  });

  await prisma.user.upsert({
    where: { employeeCode: "ADMIN001" },
    update: {
      fullName: "Quản trị hệ thống",
      role: UserRole.SUPER_ADMIN,
      departmentId: adminDepartment?.id ?? null,
      isActive: true
    },
    create: {
      employeeCode: "ADMIN001",
      fullName: "Quản trị hệ thống",
      role: UserRole.SUPER_ADMIN,
      departmentId: adminDepartment?.id ?? null
    }
  });

  console.log("Seed completed: departments + ADMIN001");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
