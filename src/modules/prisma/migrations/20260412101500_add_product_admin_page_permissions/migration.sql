-- CreateEnum
CREATE TYPE "ProductAdminPage" AS ENUM (
    'dashboard',
    'colleges',
    'hackathons',
    'public_tests',
    'public_problems',
    'problems',
    'mcq_list',
    'rbac',
    'users_management',
    'settings'
);

-- CreateTable
CREATE TABLE "product_admin_page_permission" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "page" "ProductAdminPage" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_admin_page_permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_admin_page_permission_adminUserId_page_key" ON "product_admin_page_permission"("adminUserId", "page");

-- CreateIndex
CREATE INDEX "product_admin_page_permission_adminUserId_idx" ON "product_admin_page_permission"("adminUserId");

-- CreateIndex
CREATE INDEX "product_admin_page_permission_page_idx" ON "product_admin_page_permission"("page");

-- AddForeignKey
ALTER TABLE "product_admin_page_permission" ADD CONSTRAINT "product_admin_page_permission_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
