import prisma from "./prisma";
import bcrypt from "bcryptjs";

async function main() {
  const email = "battogtokhbattur@gmail.com";
  const password = await bcrypt.hash("Admin0521$", 10);

  await prisma.user.upsert({
    where: { email },
    update: { password, role: "ADMIN" },
    create: { email, password, role: "ADMIN" }
  });

  console.log("Admin ready");
}

main();
