-- CreateTable
CREATE TABLE "product_admin_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnCollegeCreation" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnAdminAssignment" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnUserRegistration" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "language" TEXT NOT NULL DEFAULT 'en',
    "itemsPerPage" INTEGER NOT NULL DEFAULT 10,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 3600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_admin_settings_userId_key" ON "product_admin_settings"("userId");

-- AddForeignKey
ALTER TABLE "product_admin_settings" ADD CONSTRAINT "product_admin_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
