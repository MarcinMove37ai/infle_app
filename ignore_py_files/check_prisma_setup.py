#!/usr/bin/env python3
"""
Skrypt sprawdzający i naprawiający konfigurację Prisma
"""

import os
import subprocess
from pathlib import Path


def find_project_root():
    """Znajduje główny folder projektu"""
    current_path = Path(__file__).parent
    while current_path.parent != current_path:
        current_path = current_path.parent
        if (current_path / 'package.json').exists():
            return current_path
    return Path(__file__).parent.parent


def check_prisma_schema():
    """Sprawdza czy schema.prisma istnieje"""
    project_root = find_project_root()
    schema_paths = [
        project_root / 'prisma' / 'schema.prisma',
        project_root / 'src' / 'prisma' / 'schema.prisma'
    ]

    for schema_path in schema_paths:
        if schema_path.exists():
            print(f"✅ Znaleziono schema.prisma: {schema_path}")
            return schema_path

    print("❌ Nie znaleziono schema.prisma")
    return None


def check_env_file():
    """Sprawdza czy .env zawiera DATABASE_URL"""
    project_root = find_project_root()
    env_files = ['.env', '.env.local']

    for env_file in env_files:
        env_path = project_root / env_file
        if env_path.exists():
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                if 'DATABASE_URL' in content:
                    print(f"✅ Znaleziono DATABASE_URL w {env_file}")
                    return True
                else:
                    print(f"⚠️  Brak DATABASE_URL w {env_file}")
            except:
                pass

    print("❌ Nie znaleziono DATABASE_URL w plikach .env")
    return False


def run_prisma_command(command, description):
    """Uruchamia komendę Prisma"""
    project_root = find_project_root()

    try:
        print(f"🔄 {description}...")
        result = subprocess.run(
            command,
            cwd=project_root,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            print(f"✅ {description} - sukces")
            return True
        else:
            print(f"❌ {description} - błąd:")
            print(result.stderr)
            return False

    except subprocess.TimeoutExpired:
        print(f"⏰ {description} - timeout")
        return False
    except Exception as e:
        print(f"❌ {description} - błąd: {e}")
        return False


def create_sample_env():
    """Tworzy przykładowy plik .env"""
    project_root = find_project_root()
    env_path = project_root / '.env'

    if env_path.exists():
        print("⚠️  Plik .env już istnieje")
        return

    env_content = '''# Database
DATABASE_URL="postgresql://user:password@localhost:5432/crm_db"
# lub dla SQLite:
# DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Supervisor Code
SUPERVISOR_CODE="admin123"
'''

    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)

    print("✅ Utworzono przykładowy plik .env")
    print("⚠️  UWAGA: Uzupełnij prawdziwe wartości!")


def main():
    """Główna funkcja sprawdzająca Prisma"""
    print("🔍 Sprawdzanie konfiguracji Prisma...")
    print("=" * 40)

    # 1. Sprawdź schema.prisma
    schema_path = check_prisma_schema()
    if not schema_path:
        print("❌ Brak schema.prisma - sprawdź strukturę projektu")
        return

    # 2. Sprawdź .env
    has_database_url = check_env_file()
    if not has_database_url:
        print("\n🛠️  Tworzenie przykładowego .env...")
        create_sample_env()
        print("\n⚠️  Skonfiguruj DATABASE_URL w .env przed kontynuowaniem")
        return

    # 3. Prisma generate
    print("\n3️⃣  Generowanie klienta Prisma...")
    if not run_prisma_command("npx prisma generate", "Prisma generate"):
        return

    # 4. Sprawdź połączenie z bazą
    print("\n4️⃣  Sprawdzanie połączenia z bazą...")
    if not run_prisma_command("npx prisma db push", "Test połączenia z bazą"):
        print("⚠️  Sprawdź DATABASE_URL w .env")
        return

    # 5. Opcjonalnie - seed
    print("\n5️⃣  Sprawdzanie seed...")
    seed_path = find_project_root() / 'prisma' / 'seed.ts'
    if seed_path.exists():
        print("✅ Znaleziono seed.ts")
        seed_choice = input("Czy uruchomić seed? (y/N): ").lower()
        if seed_choice == 'y':
            run_prisma_command("npx prisma db seed", "Database seed")

    print("\n✅ Konfiguracja Prisma sprawdzona!")
    print("\n📝 Następne kroki:")
    print("1. npm run dev")
    print("2. Sprawdź http://localhost:3000")


if __name__ == "__main__":
    main()