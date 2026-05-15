"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function main() {
    const email = "battogtokhbattur@gmail.com";
    const password = await bcryptjs_1.default.hash("Admin0521$", 10);
    await prisma_1.default.user.upsert({
        where: { email },
        update: { password, role: "ADMIN" },
        create: { email, password, role: "ADMIN" }
    });
    console.log("Admin ready");
}
main();
