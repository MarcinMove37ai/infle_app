#!/usr/bin/env python3
"""
Skrypt konfigurujący Prisma dla autoryzacji i zarządzania użytkownikami
NextAuth.js + User management (role, statusy, profile)
Tworzy schema.prisma, przenosi seed.ts i konfiguruje bazę danych
"""

import os
import shutil
import json
from pathlib import Path


def find_project_root():
    """Znajduje główny folder projektu"""
    current_path = Path(__file__).parent
    while current_path.parent != current_path:
        current_path = current_path.parent
        if (current_path / 'package.json').exists():
            return current_path
    return Path(__file__).parent.parent


def create_prisma_schema():
    """Tworzy schema.prisma tylko dla autoryzacji (NextAuth + User management)"""
    schema_content = '''// Prisma schema - Autoryzacja i zarządzanie użytkownikami
// NextAuth.js + User management

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// NextAuth.js modele
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String     @id @default(cuid())
  name          String?
  email         String     @unique
  emailVerified DateTime?
  image         String?
  password      String
  role          UserRole   @default(USER)
  status        UserStatus @default(PENDING)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  // Relations NextAuth
  accounts Account[]
  sessions Session[]

  // Profile fields
  firstName     String?
  lastName      String?
  phone         String?
  country       String?
  countryCode   String?
  department    String?
  position      String?

  @@map("users")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Enums dla zarządzania użytkownikami
enum UserRole {
  USER
  ADMIN
  SUPERVISOR
  MANAGER
}

enum UserStatus {
  PENDING
  ACTIVE
  BLOCKED
  INACTIVE
}
'''

    project_root = find_project_root()
    prisma_dir = project_root / 'prisma'
    prisma_dir.mkdir(exist_ok=True)

    schema_path = prisma_dir / 'schema.prisma'

    with open(schema_path, 'w', encoding='utf-8') as f:
        f.write(schema_content)

    print(f"✅ Utworzono schema.prisma: {schema_path}")
    return schema_path


def move_seed_file():
    """Przenosi seed.ts z src/prisma do prisma/"""
    project_root = find_project_root()

    # Ścieżki
    old_seed_path = project_root / 'src' / 'prisma' / 'seed.ts'
    new_prisma_dir = project_root / 'prisma'
    new_seed_path = new_prisma_dir / 'seed.ts'

    # Utwórz folder prisma jeśli nie istnieje
    new_prisma_dir.mkdir(exist_ok=True)

    # Przenieś seed.ts jeśli istnieje
    if old_seed_path.exists():
        if new_seed_path.exists():
            # Zrób backup jeśli już istnieje
            backup_path = new_seed_path.with_suffix('.ts.backup')
            shutil.copy2(new_seed_path, backup_path)
            print(f"📦 Backup: {backup_path}")

        shutil.move(str(old_seed_path), str(new_seed_path))
        print(f"📁 Przeniesiono seed.ts: {old_seed_path} → {new_seed_path}")

        # Usuń pusty folder src/prisma jeśli jest pusty
        try:
            old_prisma_dir = old_seed_path.parent
            if old_prisma_dir.exists() and not any(old_prisma_dir.iterdir()):
                old_prisma_dir.rmdir()
                print(f"🗑️  Usunięto pusty folder: {old_prisma_dir}")
        except:
            pass

    else:
        # Utwórz podstawowy seed.ts
        create_basic_seed(new_seed_path)


def create_basic_seed(seed_path):
    """Tworzy podstawowy plik seed.ts - tylko użytkownicy"""
    seed_content = '''import { PrismaClient, UserRole, UserStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Rozpoczynanie seed - Użytkownicy...')

  // Hasła
  const adminPassword = await bcrypt.hash('admin123', 12)
  const userPassword = await bcrypt.hash('user123', 12)

  // Tworzenie użytkowników testowych
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.com' },
    update: {},
    create: {
      email: 'admin@crm.com',
      name: 'Administrator',
      firstName: 'Admin',
      lastName: 'System',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      phone: '+48123456789',
      country: 'Poland',
      countryCode: '+48',
      department: 'IT',
      position: 'System Administrator'
    },
  })

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@crm.com' },
    update: {},
    create: {
      email: 'supervisor@crm.com',
      name: 'Supervisor',
      firstName: 'Super',
      lastName: 'Visor',
      password: adminPassword,
      role: UserRole.SUPERVISOR,
      status: UserStatus.ACTIVE,
      phone: '+48987654321',
      country: 'Poland',
      countryCode: '+48',
      department: 'Management',
      position: 'Team Supervisor'
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@crm.com' },
    update: {},
    create: {
      email: 'manager@crm.com',
      name: 'Manager',
      firstName: 'Man',
      lastName: 'Ager',
      password: adminPassword,
      role: UserRole.MANAGER,
      status: UserStatus.ACTIVE,
      phone: '+48555666777',
      country: 'Poland',
      countryCode: '+48',
      department: 'Operations',
      position: 'Operations Manager'
    },
  })

  const user = await prisma.user.upsert({
    where: { email: 'user@crm.com' },
    update: {},
    create: {
      email: 'user@crm.com',
      name: 'Regular User',
      firstName: 'John',
      lastName: 'Doe',
      password: userPassword,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      phone: '+48111222333',
      country: 'Poland',
      countryCode: '+48',
      department: 'General',
      position: 'Employee'
    },
  })

  // Przykład użytkownika z statusem PENDING
  const pendingUser = await prisma.user.upsert({
    where: { email: 'pending@crm.com' },
    update: {},
    create: {
      email: 'pending@crm.com',
      name: 'Pending User',
      firstName: 'Jane',
      lastName: 'Smith',
      password: userPassword,
      role: UserRole.USER,
      status: UserStatus.PENDING,
      phone: '+48444555666',
      country: 'Poland',
      countryCode: '+48',
      department: 'General',
      position: 'New Employee'
    },
  })

  console.log('✅ Seed zakończony pomyślnie!')
  console.log('👤 Utworzono użytkowników:')
  console.log(`   📧 ${admin.email} (admin123) - ${admin.role}`)
  console.log(`   📧 ${supervisor.email} (admin123) - ${supervisor.role}`)
  console.log(`   📧 ${manager.email} (admin123) - ${manager.role}`)
  console.log(`   📧 ${user.email} (user123) - ${user.role}`)
  console.log(`   📧 ${pendingUser.email} (user123) - ${pendingUser.role} [${pendingUser.status}]`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Błąd podczas seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
'''

    with open(seed_path, 'w', encoding='utf-8') as f:
        f.write(seed_content)

    print(f"✅ Utworzono nowy seed.ts: {seed_path}")


def update_package_json():
    """Aktualizuje package.json z właściwą ścieżką do seed"""
    project_root = find_project_root()
    package_path = project_root / 'package.json'

    if not package_path.exists():
        print("❌ Brak package.json")
        return

    try:
        with open(package_path, 'r', encoding='utf-8') as f:
            package_data = json.load(f)

        # Aktualizuj ścieżkę seed
        if 'prisma' not in package_data:
            package_data['prisma'] = {}

        package_data['prisma']['seed'] = 'ts-node --compiler-options {\\"module\\":\\"CommonJS\\"} prisma/seed.ts'

        # Backup
        backup_path = package_path.with_suffix('.json.backup')
        shutil.copy2(package_path, backup_path)

        # Zapisz zaktualizowany package.json
        with open(package_path, 'w', encoding='utf-8') as f:
            json.dump(package_data, f, indent=2, ensure_ascii=False)

        print("✅ Zaktualizowano package.json (prisma.seed)")

    except Exception as e:
        print(f"❌ Błąd aktualizacji package.json: {e}")


def create_env_file():
    """Tworzy plik .env z konfiguracją dla autoryzacji"""
    project_root = find_project_root()
    env_path = project_root / '.env'

    if env_path.exists():
        print("⚠️  Plik .env już istnieje")
        return

    env_content = '''# Database - PostgreSQL (recommended)
DATABASE_URL="postgresql://postgres:password@localhost:5432/auth_db"

# Database - SQLite (dla rozwoju lokalnego)
# DATABASE_URL="file:./dev.db"

# NextAuth.js Configuration
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Supervisor Registration Code (dla rejestracji z uprawnieniami)
SUPERVISOR_CODE="admin123"

# Environment
NODE_ENV="development"
'''

    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)

    print("✅ Utworzono plik .env")
    print("⚠️  WAŻNE: Skonfiguruj DATABASE_URL przed uruchomieniem!")


def show_next_steps():
    """Pokazuje kolejne kroki"""
    print("\n" + "=" * 60)
    print("🎯 KONFIGURACJA PRISMA ZAKOŃCZONA! (AUTORYZACJA)")
    print("=" * 60)
    print("📁 Utworzone pliki:")
    print("   ✅ prisma/schema.prisma (NextAuth + User management)")
    print("   ✅ prisma/seed.ts (użytkownicy testowi)")
    print("   ✅ .env")
    print()
    print("🚀 KOLEJNE KROKI:")
    print("1️⃣  Skonfiguruj bazę danych w .env:")
    print("    - PostgreSQL: DATABASE_URL=\"postgresql://user:pass@localhost:5432/db\"")
    print("    - SQLite: DATABASE_URL=\"file:./dev.db\"")
    print()
    print("2️⃣  Zainstaluj zależności:")
    print("    npm install")
    print()
    print("3️⃣  Wygeneruj klienta Prisma:")
    print("    npx prisma generate")
    print()
    print("4️⃣  Utwórz bazę danych:")
    print("    npx prisma db push")
    print()
    print("5️⃣  Wypełnij danymi testowymi:")
    print("    npx prisma db seed")
    print()
    print("6️⃣  Uruchom projekt:")
    print("    npm run dev")
    print()
    print("👤 Konta testowe (po seed):")
    print("   📧 admin@crm.com / admin123 (ADMIN)")
    print("   📧 supervisor@crm.com / admin123 (SUPERVISOR)")
    print("   📧 manager@crm.com / admin123 (MANAGER)")
    print("   📧 user@crm.com / user123 (USER)")
    print("   📧 pending@crm.com / user123 (USER - PENDING)")


def main():
    """Główna funkcja konfiguracji Prisma"""
    print("🚀 Konfiguracja Prisma - AUTORYZACJA I ZARZĄDZANIE UŻYTKOWNIKAMI...")
    print("=" * 50)

    project_root = find_project_root()
    print(f"📁 Projekt: {project_root}")
    print()

    # 1. Utwórz schema.prisma
    print("1️⃣  Tworzenie schema.prisma...")
    create_prisma_schema()
    print()

    # 2. Przenieś/utwórz seed.ts
    print("2️⃣  Konfiguracja seed.ts (użytkownicy)...")
    move_seed_file()
    print()

    # 3. Aktualizuj package.json
    print("3️⃣  Aktualizacja package.json...")
    update_package_json()
    print()

    # 4. Utwórz .env
    print("4️⃣  Tworzenie .env...")
    create_env_file()
    print()

    show_next_steps()


if __name__ == "__main__":
    main()